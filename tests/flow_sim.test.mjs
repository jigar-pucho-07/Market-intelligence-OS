// tests/flow_sim.test.mjs — runs the REAL flow JSON (workflows/<FLOW>/<FLOW>.json) with flow/flow_sim.mjs: every CODE step's
// own source, every router, every loop. The app is a stateful fake built from the generated entity spec
// (app/src/config/os.config.js) that answers like app/src/app/api/data/[entity]: 201 with the numbered rows, 409 on a duplicate
// unique key, 400 on an illegal status move or an unknown column, 403 while the door is closed. A POST to another flow's
// webhook is queued and that flow is then simulated with the same body and ?k= — so a morning runs end to end:
// DAILY_SCHEDULE → MARKET_REPORT → MARKET_ANALYSE → MARKET_STORE → BROADCAST → MARKET_PUBLISH.
// The clock is fixed (Thursday 15 Oct 2026, 14:30 IST) for every flow step; flow_sim loops at most 3 items (≤ 3 recipients).
// Shim: flow_sim gives the trigger no query string, so `trigger['queryParams']['k']` is read from the body key `__k` here.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeFakes, MODEL } from './fixtures/flow_fakes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.dirname(HERE);
const SK = process.env.PUCHO_OS || JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', '.pucho-os.json'), 'utf8')).skill_path;
const { simulate } = await import(pathToFileURL(path.join(SK, 'flow', 'flow_sim.mjs')).href);
const { ENTITIES: GEN } = await import(pathToFileURL(path.join(ROOT, 'app', 'src', 'config', 'os.config.js')).href);
// os.yaml added deliveries.Attempts (retry cap); until the app is re-scaffolded the generated spec may not list it yet
const ENTITIES = structuredClone(GEN);
if (!ENTITIES.deliveries.columns.includes('Attempts')) ENTITIES.deliveries.columns.push('Attempts');

const THU = '2026-10-15T09:00:00Z'; const T = '2026-10-15';
const RealDate = Date;
async function atClock(iso, fn) {
  const fixed = new RealDate(iso).getTime();
  class FixedDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }
  globalThis.Date = FixedDate;
  try { return await fn(); } finally { globalThis.Date = RealDate; }
}

const FLOWS = ['DAILY_SCHEDULE', 'DAILY_WATCHDOG', 'MARKET_REPORT', 'MARKET_ANALYSE', 'MARKET_STORE', 'BROADCAST', 'MARKET_PUBLISH'];
const SECRET = (f) => `test-secret-${f.toLowerCase()}-0123456789`;
const ADMINS = 'ops1@example.in,ops2@example.in';
/** The flow as Studio runs it once the human has filled the constants: secrets, app URL, admins. */
function load(name, consts = {}, { keepSecrets = false } = {}) {
  let text = fs.readFileSync(path.join(ROOT, 'workflows', name, `${name}.json`), 'utf8');
  text = text.replaceAll("trigger['queryParams']['k']", "trigger['body']['__k']");
  if (!keepSecrets) for (const f of FLOWS) text = text.replaceAll(`SET_IN_STUDIO_${f}_WEBHOOK_SECRET`, SECRET(f));
  text = text.replaceAll('/api/data/', '/api/appdata/').replaceAll('SET_IN_STUDIO_APP_URL', 'https://app.test').replaceAll('SET_IN_STUDIO_ADMIN_EMAILS', ADMINS);
  for (const [k, v] of Object.entries(consts)) text = text.replace(new RegExp(`(\\\\"${k}\\\\": )[^,\\n]+`), `$1${JSON.stringify(v).replace(/"/g, '\\"')}`);
  return JSON.parse(text);
}
const HOOKS = Object.fromEntries(FLOWS.map((f) => [`SET_IN_STUDIO_${f}_WEBHOOK_URL`, f]));

/** The app's /api/data door, from the generated spec. `conditional`: honour ?Col=eq.v filters beyond the id (the kernel ticket). */
function makeApp(seed = {}, { closed = false, conditional = false, race = null } = {}) {
  const db = Object.fromEntries(Object.keys(ENTITIES).map((e) => [e, (seed[e] || []).map((r) => ({ ...r }))])); const jobs = {}; let n = 900;
  const err = (status, body) => ({ status, body });
  const app = (method, url, query, body) => {
    if (closed) return err(403, { error: 'closed' });
    const jm = url.match(/\/api\/jobs\/([^/?]+)$/);
    if (jm) { if (!/^JOB-[0-9A-F]{12}$/.test(jm[1])) return err(404, { error: 'not found' }); jobs[jm[1]] = body; return { status: 200, body: { ok: true } }; }
    const entity = url.split('/api/appdata/')[1].split(/[?/]/)[0]; const E = ENTITIES[entity]; if (!E) return err(404, { error: 'not found' });
    const idc = E.id.column; const rows = db[entity];
    const bad = (r) => Object.keys(r).find((k) => !E.columns.includes(k));
    const enumBad = (r) => Object.entries(E.field_rules || {}).find(([k, rule]) => rule.one_of && r[k] !== undefined && r[k] !== '' && !rule.one_of.includes(r[k]))
      || (E.status && r[E.status.column] !== undefined && !E.status.values.includes(r[E.status.column]));
    const dupOf = (r, except) => [...(E.unique || []).map((c) => [c]), ...(E.unique_together || [])]
      .find((g) => g.every((c) => String(r[c] ?? '') !== '') && rows.some((x) => x[idc] !== except && g.every((c) => String(x[c]) === String(r[c]))));
    const stage = (from, r) => { for (const f of E.required || []) if (String(r[f] ?? '').trim() === '') return `${f} is required`;
      const sc = E.status && E.status.column; if (!sc) return null; const to = r[sc]; if (!to) return null;
      if (from && to !== from && !(E.transitions[from] || []).includes(to)) return `cannot move from ${from} to ${to}`;
      for (const f of (E.requires_on || {})[to] || []) if (r[f] === '' || r[f] == null) return `${f} required`; return null; };
    if (method === 'GET') return { status: 200, body: rows.map((r) => ({ ...r })) };
    if (method === 'POST') {
      const list = Array.isArray(body) ? body : [body]; const out = [];
      for (const r of list) {
        if (bad(r)) return err(400, { error: 'invalid rows', detail: bad(r) }); if (enumBad(r)) return err(400, { ok: false, errors: { field: 'not allowed' } });
        const s = stage('', r); if (s) return err(400, { ok: false, errors: { stage: s } });
        const d = dupOf(r); if (d) return err(409, { ok: false, errors: { [d.join('+')]: 'already in use' } });
      }
      for (const r of list) {
        const id = String(r[idc] || '').trim() || `${E.id.prefix}2026-${++n}`;
        if (rows.some((x) => x[idc] === id)) continue;                                   // ON CONFLICT (id) DO NOTHING
        const row = { ...r, [idc]: id }; if (E.created && !row[E.created]) row[E.created] = new Date().toISOString();
        rows.push(row); out.push({ ...row });
      }
      return { status: 201, body: out };
    }
    if (method === 'PATCH') {
      const q = String(query[idc] || ''); const id = q.startsWith('eq.') ? q.slice(3) : q;
      if (!id) return err(400, { error: `?${idc}=eq.<id> is required` });
      const cur = rows.find((x) => x[idc] === id); if (!cur) return err(404, { error: 'not found' });
      if (race && race(entity, cur, body)) { /* another request changed the row between the read and this write */ }
      if (conditional) for (const [k, v] of Object.entries(query)) if (k !== idc && String(v).startsWith('eq.') && String(cur[k] ?? '') !== String(v).slice(3)) return err(404, { error: 'not found (condition)' });
      if (bad(body)) return err(400, { error: 'invalid patch' }); if (enumBad(body)) return err(400, { ok: false });
      const merged = { ...cur, ...body }; const s = stage(cur[E.status?.column], merged); if (s) return err(400, { ok: false, errors: { stage: s } });
      if (dupOf(body, id)) return err(409, { ok: false });
      Object.assign(cur, body); return { status: 200, body: [{ ...cur }] };
    }
    return err(405, {});
  };
  return { app, db, jobs };
}

/** Run a flow (with its secret unless `k` is given); webhook POSTs to other flows are followed with their ?k=. */
async function run(world, name, body, opts = {}) {
  const calls = []; const fakes = makeFakes({ app: world.app.app, calls, model: world.model, email: world.email, feeds: world.feeds });
  const k = 'k' in opts ? opts.k : SECRET(name);
  const r = await atClock(world.clock || THU, () => simulate(load(name, world.consts?.[name], opts), { ...body, __k: k }, fakes));
  world.log.push({ name, body, ...r, calls });
  assert.deepEqual(r.failures, [], `${name}: ${r.failures.join(' | ')}`);
  if (String(load(name).template.trigger.settings.pieceName).endsWith('tool-webhook')) assert.ok(r.responses.length >= 1, `${name} ends in a Return`);
  if (!opts.noFollow) for (const c of calls) {
    const target = HOOKS[String(c.inputs.url)];
    if (c.piece === 'http:send_request' && target) await run(world, target, c.inputs.body.data, { k: c.inputs.queryParams.k });
  }
  return r;
}
const newWorld = (seed, o = {}) => ({ app: makeApp(seed, o), log: [], model: o.model, email: o.email, consts: o.consts, clock: o.clock, feeds: o.feeds });
const SUBS = [
  { Subscriber_ID: 'SUB-2026-0001', Name: 'Amit Shah', WhatsApp: '+919876543210', Email: 'amit.shah@example.in', Status: 'Active', Opt_In_At: '2026-08-01', Opt_In_Source: 'WhatsApp reply' },
  { Subscriber_ID: 'SUB-2026-0002', Name: 'Neha Iyer', WhatsApp: '+919820011223', Email: 'neha.iyer@example.in', Status: 'Active', Opt_In_At: '2026-08-04', Opt_In_Source: 'Web form' },
  { Subscriber_ID: 'SUB-2026-0003', Name: 'Rohit Verma', WhatsApp: '+919811122334', Email: 'rohit.verma@example.in', Status: 'Paused', Opt_In_At: '2026-08-20', Opt_In_Source: 'Signed form' },
];
const all = (w) => w.log.flatMap((l) => l.calls);
const sends = (w) => all(w).filter((c) => c.piece === 'gmail:send_email');
const to = (c) => c.inputs.receiver[0];
const paid = (w) => all(w).filter((c) => c.piece === 'llm-ai:askLlm' || c.piece === 'gmail:send_email' || /news\.google\.com|reuters/.test(String(c.inputs.url)));
const JOB = 'JOB-3F9A1C22B7E0';
const readyToday = (o = {}) => ({ Report_ID: 'MIR-2026-0101', Report_Date: T, Created_At: '2026-10-15T00:31:00Z', Status: 'Ready', Sentiment: 'BULLISH', Confidence_Level: 'HIGH', Confidence_Pct: 74, Driver_1: 'FII inflows', WhatsApp_Message: 'w', ...o });

test('MARKET_REPORT.run (schedule), end to end: report Ready → news with deterministic ids → email to each Active subscriber → Sent + counts + reader copy', async () => {
  const w = newWorld({ subscribers: SUBS });
  await run(w, 'MARKET_REPORT', { action: 'run', Trigger: 'Schedule', _who: 'Test', _job: JOB });
  assert.deepEqual(w.log.map((l) => l.name), ['MARKET_REPORT', 'MARKET_ANALYSE', 'MARKET_STORE', 'BROADCAST', 'MARKET_PUBLISH']);
  const [rep] = w.app.db.reports;
  assert.equal(rep.Report_Date, T); assert.equal(rep.Trigger, 'Schedule'); assert.equal(rep.Sentiment, 'CAUTIOUSLY BULLISH'); assert.equal(rep.Confidence_Pct, 100);
  assert.equal(rep.Status, 'Sent'); assert.equal(rep.Sent_Count, 2); assert.equal(rep.Failed_Count, 0);
  assert.ok(rep.WhatsApp_Message.length <= 4000);
  for (const n of ['Economic Times Markets', 'Moneycontrol', 'Reuters India', 'Google Finance News', 'Global Market Cues']) assert.match(rep.Source_Status, new RegExp(n + ' [1-9]'));
  assert.equal(rep.View_Intraday, '', 'the stop-loss sentence never reached the row');
  assert.ok(w.app.db.news_articles.length > 0 && w.app.db.news_articles.every((a) => a.Article_ID.startsWith(`NWS-${rep.Report_ID}-`) && a.Report_ID === rep.Report_ID));
  const s = sends(w); assert.deepEqual(s.map(to).sort(), ['amit.shah@example.in', 'neha.iyer@example.in'], 'Paused Rohit gets nothing');
  assert.ok(s.every((c) => /^Daily Market Intelligence — 15 Oct 2026 · CAUTIOUSLY BULLISH/.test(c.inputs.subject) && c.inputs.body_type === 'html' && /DAILY MARKET INTELLIGENCE/.test(c.inputs.body)));
  assert.ok(w.app.db.deliveries.every((d) => d.Status === 'Sent' && d.Message_ID.startsWith('18fake') && d.Kind === 'Report' && d.Attempts === 1));
  assert.equal(w.app.db.published_reports.length, 1); assert.ok(!('Error_Message' in w.app.db.published_reports[0]));
  assert.ok(all(w).every((c) => !/\/api\/appdata\/subscribers/.test(c.inputs.url) || c.inputs.method === 'GET'), 'no flow writes subscribers');
  assert.equal(w.app.jobs[JOB].status, 'done'); assert.equal(w.app.jobs[JOB].result.Status, 'Ready');
});

test('no webhook secret (owner decision 23 Oct 2026): any caller with a known action gets past the first step; an unknown action is 400 before anything is called', async () => {
  const bodies = { MARKET_REPORT: { action: 'run' }, MARKET_ANALYSE: { action: 'run' }, MARKET_STORE: { action: 'store', Mode: 'run', report: readyToday(), articles: [] },
    BROADCAST: { action: 'send', Report_ID: 'MIR-2026-0101' }, MARKET_PUBLISH: { action: 'publish', Report_ID: 'MIR-2026-0101' } };
  for (const [flow, body] of Object.entries(bodies)) {
    const fl = load(flow); const first = fl.template.trigger.nextAction;
    assert.equal(first.name, 'step_constants'); assert.deepEqual(Object.keys(first.settings.input), ['action'], `${flow}: the first step maps only the action`);
    assert.doesNotMatch(first.settings.sourceCode.code, /webhook_secret|secretMatches|inputs\.k\b/, `${flow}: no secret check left`);
    for (const k of [undefined, '', 'anything']) {
      const w = newWorld({ reports: [readyToday()], subscribers: SUBS });
      const r = await run(w, flow, body, { k, noFollow: true });
      assert.ok(!r.trace.some((x) => x.startsWith('step_denied_done')), `${flow} k=${k}: refused`);
      assert.notEqual(r.responses[0].error, 'unauthorized', `${flow} k=${k}`);
    }
    const bad = newWorld({ reports: [readyToday()], subscribers: SUBS });
    const r = await run(bad, flow, { ...body, action: 'drop_tables' }, { noFollow: true });
    assert.equal(r.responses[0].error, 'unknown action', flow); assert.equal(all(bad).length, 0, `${flow}: nothing called`);
  }
});

test('SA-02: MARKET_REPORT refuses before any feed or model call — the schedule when today is Ready / Sent, a rerun of another day', async () => {
  for (const st of ['Ready', 'Sent']) {
    const w = newWorld({ reports: [readyToday({ Status: st })] });
    const r = await run(w, 'MARKET_REPORT', { action: 'run', Trigger: 'Schedule', _job: JOB });
    assert.equal(r.responses[0].code, 'EXISTS'); assert.equal(paid(w).length, 0, 'no feed, no model'); assert.equal(w.log.length, 1);
    assert.equal(w.app.jobs[JOB].status, 'failed');
  }
  {
    const row = readyToday({ Status: 'Failed', Report_Date: '2026-10-14' });
    const w = newWorld({ reports: [row] });
    const r = await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: row.Report_ID });
    assert.equal(r.responses[0].ok, false); assert.equal(r.responses[0].code, 'STALE_DATE'); assert.equal(paid(w).length, 0);
  }
  const w = newWorld({ reports: [{ Report_ID: 'MIR-2026-0102', Report_Date: T, Status: 'Failed', Error_Message: 'timeout' }], subscribers: [] });
  await run(w, 'MARKET_REPORT', { action: 'run', Trigger: 'Schedule' });
  assert.equal(w.app.db.reports.length, 1); assert.equal(w.app.db.reports[0].Status, 'Ready', 'today\'s Failed row is re-run in place (no subscriber → stays Ready)');
});

test('MARKET_REPORT.rerun: Failed → Failed (bad model) → Ready on the same Report_ID; the news is never doubled', async () => {
  const w = newWorld({ reports: [{ Report_ID: 'MIR-2026-0099', Report_Date: T, Status: 'Failed', Error_Message: 'No news', Created_At: '2026-10-15T00:30:00Z' }], subscribers: [] }, { model: MODEL.broken });
  await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: 'MIR-2026-0099', _job: JOB });
  assert.equal(w.app.db.reports[0].Status, 'Failed'); assert.match(w.app.db.reports[0].Error_Message, /^MODEL_JSON/);
  const n1 = w.app.db.news_articles.length; assert.ok(n1 > 0);
  w.model = undefined; await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: 'MIR-2026-0099' });
  assert.equal(w.app.db.reports[0].Status, 'Ready'); assert.equal(w.app.db.news_articles.length, n1, 'same articles, same ids');
});

test('a manual run / rerun regenerates today\'s Ready or Sent report in place and sends nothing (owner decision 26 Oct 2026)', async () => {
  for (const [st, payload] of [['Sent', { action: 'run', Trigger: 'Manual' }], ['Ready', { action: 'rerun' }], ['Sent', { action: 'rerun' }]]) {
    const row = readyToday({ Status: st, Driver_1: 'OLD DRIVER' });
    const w = newWorld({ reports: [row], subscribers: SUBS });
    await run(w, 'MARKET_REPORT', { ...payload, ...(payload.action === 'rerun' ? { Report_ID: row.Report_ID } : {}), _job: JOB });
    assert.equal(w.app.db.reports.length, 1, `${st} ${payload.action}: same row`); assert.equal(w.app.db.reports[0].Report_ID, row.Report_ID);
    assert.equal(w.app.db.reports[0].Status, 'Ready'); assert.notEqual(w.app.db.reports[0].Driver_1, 'OLD DRIVER', 'regenerated');
    assert.equal(sends(w).length, 0, `${st} ${payload.action}: nothing sent`); assert.equal(w.app.jobs[JOB].status, 'done');
  }
  const row = readyToday({ Status: 'Sent', Driver_1: 'OLD DRIVER' });
  const w = newWorld({ reports: [row], subscribers: SUBS }, { model: MODEL.broken });
  await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: row.Report_ID, _job: JOB });
  assert.equal(w.app.db.reports[0].Status, 'Sent'); assert.equal(w.app.db.reports[0].Driver_1, 'OLD DRIVER', 'a failed re-run keeps the good report');
  assert.equal(w.app.jobs[JOB].status, 'failed'); assert.equal(w.app.jobs[JOB].result.code, 'RERUN_FAILED');
});

test('SA-01: a row handed to MARKET_STORE is re-checked — advice in Driver_1 fails it, the WhatsApp text is rebuilt', async () => {
  const w = newWorld({ subscribers: SUBS });
  await run(w, 'MARKET_STORE', { action: 'store', Mode: 'run', Trigger: 'Manual', report: readyToday({ Report_ID: undefined, Driver_1: 'Buy Reliance above 2,950', WhatsApp_Message: 'http://evil' }), articles: [] });
  const [rep] = w.app.db.reports; assert.equal(rep.Status, 'Failed'); assert.equal(rep.Error_Message, 'Advice language removed — review');
  assert.ok(sends(w).every((c) => /report run failed/.test(c.inputs.subject)), 'only the admin alert goes out');
});

test('no news from any source → a Failed row and the alert email to each admin, nothing to subscribers (S6)', async () => {
  const w = newWorld({ subscribers: SUBS }, { feeds: 'down' });
  await run(w, 'MARKET_REPORT', { action: 'run', Trigger: 'Schedule' });
  const [rep] = w.app.db.reports; assert.equal(rep.Status, 'Failed'); assert.match(rep.Error_Message, /^NO_NEWS/);
  assert.equal(all(w).filter((c) => c.piece === 'llm-ai:askLlm').length, 0, 'no model call');
  assert.deepEqual(sends(w).map(to), ['ops1@example.in', 'ops2@example.in']);
  assert.ok(sends(w).every((c) => /report run failed/.test(c.inputs.subject) && /Error: NO_NEWS/.test(c.inputs.body)));
  assert.equal(w.app.db.published_reports.length, 0); assert.equal(rep.Sent_Count, undefined);
});

test('BROADCAST.send twice: the second gets 409 for everyone and makes no email call and no PATCH', async () => {
  const w = newWorld({ reports: [readyToday()], subscribers: SUBS });
  await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101', _job: JOB });
  assert.equal(sends(w).length, 2); assert.equal(w.app.db.reports[0].Status, 'Sent'); assert.equal(w.app.jobs[JOB].status, 'done');
  const before = all(w).length; await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101' });
  const second = all(w).slice(before);
  assert.equal(second.filter((c) => c.piece === 'gmail:send_email').length, 0);
  assert.equal(second.filter((c) => c.inputs.method === 'PATCH' && /deliveries/.test(c.inputs.url)).length, 0);
  assert.equal(w.app.db.deliveries.length, 2); assert.equal(w.app.db.reports[0].Sent_Count, 2);
});

test('SA-03: yesterday\'s Ready draft is never sent; an alert carries only the report\'s or the fixed watchdog text', async () => {
  const w = newWorld({ reports: [readyToday({ Report_Date: '2026-10-14' })], subscribers: SUBS });
  const r = await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101' });
  assert.equal(sends(w).length, 0); assert.match(r.responses[0].reason, /only today's report/);
  const a = newWorld({});
  await run(a, 'BROADCAST', { action: 'alert', Report_ID: '', Error_Message: 'Click http://evil' });
  assert.equal(sends(a).length, 2); assert.ok(sends(a).every((c) => /No report row by 06:20 IST for 2026-10-15/.test(c.inputs.body) && !/evil|Click/.test(c.inputs.body)));
  await atClock('2026-10-15T10:00:00Z', async () => {}); a.clock = '2026-10-15T10:00:00Z';
  await run(a, 'BROADCAST', { action: 'alert', Report_ID: '' });
  assert.equal(sends(a).length, 4, 'a second alert the same day still reaches the admins');
});

test('retry: Attempts + 1 per retry, refused at 3, to the record\'s address; a concurrent claim (conditional PATCH) sends nothing', async () => {
  const w = newWorld({ reports: [readyToday({ Status: 'Sent' })], subscribers: SUBS, deliveries: [{ Delivery_ID: 'DLV-2026-0001', Kind: 'Report', Report_ID: 'MIR-2026-0101', Report_Date: T,
    Subscriber_ID: 'SUB-2026-0002', Subscriber_Name: 'Neha Iyer', Status: 'Failed', Attempts: 1, Error_Message: '131026' }] },
  { email: () => { throw new Error('HTTP 400: Invalid To header'); } });
  const d = w.app.db.deliveries[0];
  const r1 = await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: 'DLV-2026-0001', To: '+910000000000' });
  assert.equal(r1.responses[0].sent, false); assert.equal(d.Attempts, 2); assert.equal(to(sends(w).at(-1)), 'neha.iyer@example.in', 'the record\'s address, never the payload');
  w.email = undefined;
  const r2 = await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: 'DLV-2026-0001' });
  assert.equal(r2.responses[0].sent, true); assert.equal(d.Attempts, 3); assert.equal(d.Status, 'Sent');
  d.Status = 'Failed';
  const r3 = await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: 'DLV-2026-0001' });
  assert.equal(r3.responses[0].sent, false); assert.match(r3.responses[0].error, /cap is 3/); assert.equal(sends(w).length, 2);
  assert.equal(w.log.at(-1).calls.filter((c) => c.node === 'step_retry_claim').length, 0, 'a refused retry sends no claim request (Studio would stop the run on its 400)');
  const race = newWorld({ reports: [readyToday({ Status: 'Sent' })], subscribers: SUBS, deliveries: [{ ...d, Status: 'Failed', Attempts: 1 }] },
    { conditional: true, race: (e, cur) => { if (e === 'deliveries') cur.Attempts = 2; } });
  // the claim stops the run when the app refuses it (as Studio does on a 4xx) — no email goes out on a lost race
  const calls = []; const fakes = makeFakes({ app: race.app.app, calls });
  const rr = await atClock(THU, () => simulate(load('BROADCAST'), { action: 'retry', Delivery_ID: 'DLV-2026-0001', __k: SECRET('BROADCAST') }, fakes));
  assert.ok(rr.failures.some((f) => f.startsWith('step_retry_claim')), `the lost claim stops the run: ${rr.failures.join(' | ')}`);
  assert.equal(calls.filter((c) => c.piece === 'gmail:send_email').length, 0, 'the claim found Attempts changed → no send');
});

test('ZeroBounce (owner decision 24 Oct 2026): every queued address is checked before its email — invalid → no email, delivery Failed with the reason; catch-all is sent', async () => {
  const subs = [{ ...SUBS[0], Email: 'bounce.amit@example.in' }, { ...SUBS[1], Email: 'neha@catchall.example.in' }, SUBS[2]];
  const w = newWorld({ reports: [readyToday()], subscribers: subs });
  await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101', _job: JOB });
  assert.equal(all(w).filter((c) => c.piece === 'zerobounce:validateEmail').length, 2, 'one check per queued recipient');
  assert.deepEqual(sends(w).map(to), ['neha@catchall.example.in']);
  const by = Object.fromEntries(w.app.db.deliveries.map((d) => [d.Subscriber_ID, d]));
  assert.equal(by['SUB-2026-0001'].Status, 'Failed'); assert.match(by['SUB-2026-0001'].Error_Message, /^Email not sent — ZeroBounce: invalid mailbox_not_found/);
  assert.equal(by['SUB-2026-0002'].Status, 'Sent');
  assert.equal(w.app.db.reports[0].Sent_Count, 1); assert.equal(w.app.db.reports[0].Failed_Count, 1);
  // ZeroBounce down (no credits, bad key): no email goes out, the delivery says why, the run still finishes with its Return
  const down = newWorld({ reports: [readyToday()], subscribers: SUBS }, {});
  const calls = []; const fakes = makeFakes({ app: down.app.app, calls, zerobounce: () => { throw new Error('HTTP 400: Invalid API key or your account ran out of credits'); } });
  const r = await atClock(THU, () => simulate(load('BROADCAST'), { action: 'send', Report_ID: 'MIR-2026-0101' }, fakes));
  assert.deepEqual(r.failures, []); assert.equal(calls.filter((c) => c.piece === 'gmail:send_email').length, 0);
  assert.ok(down.app.db.deliveries.every((d) => d.Status === 'Failed' && /ZeroBounce: .*ran out of credits/.test(d.Error_Message)));
});

test('ZeroBounce on retry: a still-invalid address sends nothing and answers why; once corrected, the retry is sent', async () => {
  const subs = [SUBS[0], { ...SUBS[1], Email: 'neha@nowhere.example' }];
  const w = newWorld({ reports: [readyToday({ Status: 'Sent' })], subscribers: subs, deliveries: [{ Delivery_ID: 'DLV-2026-0001', Kind: 'Report', Report_ID: 'MIR-2026-0101', Report_Date: T,
    Subscriber_ID: 'SUB-2026-0002', Subscriber_Name: 'Neha Iyer', Status: 'Failed', Attempts: 1, Error_Message: 'Email not sent — ZeroBounce: invalid mailbox_not_found' }] });
  const d = w.app.db.deliveries[0];
  const r1 = await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: 'DLV-2026-0001' });
  assert.equal(r1.responses[0].ok, false); assert.equal(r1.responses[0].sent, false);
  assert.match(r1.responses[0].error, /failed the ZeroBounce check \(invalid mailbox_not_found\)\. Correct the subscriber's email/);
  assert.equal(sends(w).length, 0); assert.equal(d.Status, 'Failed'); assert.equal(d.Attempts, 2, 'the check counts as an attempt');
  w.app.db.subscribers[1].Email = 'neha.iyer@example.in';
  const r2 = await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: 'DLV-2026-0001' });
  assert.equal(r2.responses[0].sent, true); assert.equal(d.Status, 'Sent'); assert.deepEqual(sends(w).map(to), ['neha.iyer@example.in']);
});

test('deliveries required (24 Oct 2026): the queue step run on its own — Studio "Test step", no loop item — is a 400 and stores nothing', async () => {
  assert.deepEqual(ENTITIES.deliveries.required, ['Kind', 'Status', 'Subscriber_ID'], 'os.yaml deliveries.required reached the generated config');
  const w = newWorld({});
  const queue = []; const find = (n) => { if (!n) return; if (n.name === 'step_send_queue') queue.push(n); (n.children || []).forEach(find); find(n.firstLoopAction); find(n.nextAction); };
  find(load('BROADCAST').template.trigger);
  const blank = Object.fromEntries(Object.entries(queue[0].settings.input.body.data).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('{{') ? '' : v]));
  assert.deepEqual(blank, { Kind: '', Report_ID: '', Report_Date: '', Subscriber_ID: '', Subscriber_Name: '', Sentiment: '', Status: '', Delivery_ID: '', Attempts: 1 });
  const r = w.app.app('POST', 'https://app.test/api/appdata/deliveries', {}, blank);
  assert.equal(r.status, 400); assert.equal(w.app.db.deliveries.length, 0);
});

test('publish: nothing actually sent → the report stays Ready and the app job fails', async () => {
  const w = newWorld({ reports: [readyToday()], subscribers: SUBS }, { email: () => { throw new Error('HTTP 400: Invalid To header'); } });
  await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101', _job: JOB });
  assert.equal(w.app.db.reports[0].Status, 'Ready'); assert.equal(w.app.db.published_reports.length, 0);
  assert.equal(w.app.jobs[JOB].status, 'failed'); assert.match(w.app.jobs[JOB].result.note, /NOTHING_SENT/);
});

test('closed door (403): MARKET_STORE refuses with APP_CLOSED; the watchdog still alerts (fixed clock: a Thursday)', async () => {
  const w = newWorld({}, { closed: true });
  const r = await run(w, 'MARKET_STORE', { action: 'store', Mode: 'run', report: { Status: 'Failed', Error_Message: 'x' }, articles: [] });
  assert.equal(r.responses[0].code, 'APP_CLOSED');
  const wd = await run(w, 'DAILY_WATCHDOG', {}, { noFollow: true });
  assert.ok(wd.trace.includes('step_router→No report row — alert the admins'));
});

test('DAILY_SCHEDULE → MARKET_REPORT {action: run, Trigger: Schedule}, no ?k=; a holiday or a Saturday skips; the watchdog alerts only without a row', async () => {
  const w = newWorld({ subscribers: [] });
  await run(w, 'DAILY_SCHEDULE', {}, { noFollow: true });
  const post = w.log[0].calls.find((c) => c.node === 'step_run_post');
  assert.deepEqual(post.inputs.body.data, { action: 'run', Trigger: 'Schedule', _who: 'flow:DAILY_SCHEDULE' });
  assert.equal(post.inputs.url, 'SET_IN_STUDIO_MARKET_REPORT_WEBHOOK_URL'); assert.deepEqual(post.inputs.queryParams, {});
  for (const o of [{ consts: { DAILY_SCHEDULE: { holidays: [T] } } }, { clock: '2026-10-17T00:30:00Z' }]) {
    const h = newWorld({}, o); await run(h, 'DAILY_SCHEDULE', {}, { noFollow: true });
    assert.equal(h.log[0].calls.find((c) => c.node === 'step_run_post'), undefined);
  }
  const ok = newWorld({ reports: [{ Report_ID: 'MIR-2026-0101', Report_Date: T, Status: 'Failed', Error_Message: 'x' }] });
  assert.ok((await run(ok, 'DAILY_WATCHDOG', {}, { noFollow: true })).trace.includes('step_router→Report row present'));
  const miss = newWorld({ subscribers: [] }); await run(miss, 'DAILY_WATCHDOG', {});
  assert.deepEqual(sends(miss).map(to), ['ops1@example.in', 'ops2@example.in']);
});

test('every flow file is free of secrets and of free-text WhatsApp (S5, S7); the 06:00 trigger is IST (S1)', () => {
  for (const f of FLOWS) {
    const text = fs.readFileSync(path.join(ROOT, 'workflows', f, `${f}.json`), 'utf8');
    assert.doesNotMatch(text, /Bearer (?!\{\{)/, `${f}: a literal bearer token`);
    assert.doesNotMatch(text, /send_text_message|graph\.facebook\.com|api\.groq\.com/, `${f}: free text or a direct provider call`);
    assert.doesNotMatch(text, /"cronExpression": "0 30 0/, `${f}: the S1 cron`);
  }
  const sched = load('DAILY_SCHEDULE').template.trigger.settings;
  assert.deepEqual([sched.triggerName, sched.input.hour_of_the_day, sched.input.timezone, sched.input.run_on_weekends], ['every_day', '6', 'Asia/Kolkata', false]);
});

// ── security audit round 2 ──
const WEBHOOK_FLOWS = { MARKET_REPORT: { action: 'run' }, MARKET_ANALYSE: { action: 'run' }, MARKET_STORE: { action: 'store', Mode: 'run', report: readyToday(), articles: [] },
  BROADCAST: { action: 'send', Report_ID: 'MIR-2026-0101' }, MARKET_PUBLISH: { action: 'publish', Report_ID: 'MIR-2026-0101' } };
/** Every router that reads step_constants['gate'] is an allow-list: only gate = 'ok' (exact case) continues; the fallback answers 401. */
function assertAllowList(flow, name) {
  const routers = []; const walk = (n) => { if (!n) return; if (n.type === 'ROUTER') routers.push(n); (n.children || []).forEach(walk); walk(n.firstLoopAction); walk(n.nextAction); };
  walk(flow.template.trigger);
  const gates = routers.filter((r) => JSON.stringify(r.settings.branches).includes("step_constants['gate']"));
  assert.equal(gates.length, 1, `${name}: one gate router`);
  const [r] = gates; const br = r.settings.branches;
  const fb = br.findIndex((b) => b.branchType === 'FALLBACK');
  assert.equal(fb, br.length - 1, `${name}: fallback last`);
  const fbChild = r.children[fb];
  assert.ok(fbChild && fbChild.settings.actionName === 'return_response' && fbChild.settings.input.fields.status === 401, `${name}: the fallback answers 401`);
  br.forEach((b, i) => {
    const child = r.children[i]; const ends = (() => { let n = child; while (n && n.nextAction) n = n.nextAction; return n && n.settings && n.settings.actionName === 'return_response'; })();
    const continues = !child || (!ends && child);
    const allowed = (b.conditions || []).every((g) => g.some((c) => c.firstValue === "{{step_constants['gate']}}" && c.operator === 'TEXT_EXACTLY_MATCHES' && c.secondValue === 'ok' && c.caseSensitive === true));
    if (b.branchType !== 'FALLBACK' && (continues || !(b.conditions || []).every((g) => g.some((c) => c.secondValue === 'bad_action'))))
      assert.ok(allowed, `${name}: branch "${b.branchName}" continues without requiring gate = 'ok'`);
  });
}
test('SA-21: every gate router is an allow-list (only gate = "ok" continues, the fallback answers 401) — and the old fail-open order is caught', () => {
  for (const f of Object.keys(WEBHOOK_FLOWS)) assertAllowList(load(f), f);
  const old = load('MARKET_ANALYSE'); const r = old.template.trigger.nextAction.nextAction;     // the round-1 shape: stop on denied / bad_action, fallback continues
  r.settings.branches = [{ branchName: 'Unauthorized → 401', branchType: 'CONDITION', conditions: [[{ operator: 'TEXT_EXACTLY_MATCHES', firstValue: "{{step_constants['gate']}}", secondValue: 'denied', caseSensitive: false }]] },
    { branchName: 'Unknown action → 400', branchType: 'CONDITION', conditions: [[{ operator: 'TEXT_EXACTLY_MATCHES', firstValue: "{{step_constants['gate']}}", secondValue: 'bad_action', caseSensitive: false }]] },
    { branchName: 'Authorised', branchType: 'FALLBACK' }];
  r.children = [r.children.find((c) => c && c.settings.input.fields.status === 401), r.children.find((c) => c && c.settings.input.fields.status === 400), null];
  assert.throws(() => assertAllowList(old, 'mutant'), /fallback answers 401/);
});
test('SA-21: a gate that is missing, empty, mis-cased or padded stops the run before any read, fetch, AI step, send or write', async () => {
  for (const [flow, body] of Object.entries(WEBHOOK_FLOWS)) {
    for (const g of [undefined, '', 'OK', 'OK ', 'denied ', 'allowed']) {
      const fl = load(flow); const k = fl.template.trigger.nextAction;
      k.settings.sourceCode.code = k.settings.sourceCode.code.replace('return { ...C, gate };', g === undefined ? 'return { ...C };' : `return { ...C, gate: ${JSON.stringify(g)} };`);
      assert.ok(!k.settings.sourceCode.code.includes('return { ...C, gate };'), 'the gate was injected');
      const calls = []; const w = newWorld({ reports: [readyToday()], subscribers: SUBS });
      const r = await atClock(THU, () => simulate(fl, { ...body, __k: SECRET(flow) }, makeFakes({ app: w.app.app, calls })));
      assert.deepEqual(r.failures, []); assert.equal(calls.length, 0, `${flow} gate=${JSON.stringify(g)}: nothing called`);
      assert.equal(r.responses[0].error, 'unauthorized', `${flow} gate=${JSON.stringify(g)}`);
    }
  }
});
test('SA-20: no step reads the query string or sends a ?k=; no Return, write or job result carries a secret', () => {
  for (const f of FLOWS) {
    const fl = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', f, `${f}.json`), 'utf8'));
    const nodes = []; const walk = (n) => { if (!n) return; nodes.push(n); (n.children || []).forEach(walk); walk(n.firstLoopAction); walk(n.nextAction); };
    walk(fl.template.trigger);
    for (const n of nodes) {
      const input = JSON.stringify((n.settings || {}).input || {});
      assert.doesNotMatch(input, /trigger\['queryParams'\]/, `${f}.${n.name} reads the query string`);
      assert.doesNotMatch(input, /"queryParams":\{"k"/, `${f}.${n.name} sends a ?k=`);
      const outBound = n.settings && (n.settings.actionName === 'return_response' || (n.settings.input && n.settings.input.body));
      if (outBound) assert.doesNotMatch(JSON.stringify(n.settings.input.fields || n.settings.input.body), /_secret'\]|webhook_secret|queryParams|\?k=/, `${f}.${n.name} writes a secret`);
    }
  }
});
