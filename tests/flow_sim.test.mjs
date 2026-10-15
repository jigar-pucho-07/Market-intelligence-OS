// tests/flow_sim.test.mjs — runs the REAL flow JSON (workflows/<FLOW>/<FLOW>.json) with flow/flow_sim.mjs: every CODE step's
// own source, every router, every loop. The app is a stateful fake built from the generated entity spec
// (app/src/config/os.config.js) that answers like app/src/app/api/data/[entity]: 201 with the numbered rows, 409 on a duplicate
// unique key, 400 on an illegal status move or an unknown column, 403 while the door is closed. A POST to another flow's
// webhook is queued and that flow is then simulated with the same body — so a morning runs end to end:
// DAILY_SCHEDULE → MARKET_REPORT → MARKET_STORE → BROADCAST → MARKET_PUBLISH. (flow_sim loops at most 3 items: ≤ 3 recipients.)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeFakes, MODEL } from './fixtures/flow_fakes.mjs';
import { istDate } from '../app/src/custom/lib/market.js';

const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.dirname(HERE);
const SK = process.env.PUCHO_OS || JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', '.pucho-os.json'), 'utf8')).skill_path;
const { simulate } = await import(pathToFileURL(path.join(SK, 'flow', 'flow_sim.mjs')).href);
const { ENTITIES } = await import(pathToFileURL(path.join(ROOT, 'app', 'src', 'config', 'os.config.js')).href);

const ADMINS = '+919800000001,+919800000002';
/** The flow as Studio would run it once the human has filled the constants: app door reached through the fake, admins set. */
function load(name, consts = {}) {
  let text = fs.readFileSync(path.join(ROOT, 'workflows', name, `${name}.json`), 'utf8');
  text = text.replaceAll('/api/data/', '/api/appdata/').replaceAll('SET_IN_STUDIO_APP_URL', 'https://app.test').replaceAll('SET_IN_STUDIO_ADMIN_WHATSAPP_NUMBERS', ADMINS);
  for (const [k, v] of Object.entries(consts)) text = text.replace(new RegExp(`(\\\\"${k}\\\\": )[^,\\n]+`), `$1${JSON.stringify(v).replace(/"/g, '\\"')}`);
  return JSON.parse(text);
}
const HOOKS = { SET_IN_STUDIO_MARKET_REPORT_WEBHOOK_URL: 'MARKET_REPORT', SET_IN_STUDIO_MARKET_STORE_WEBHOOK_URL: 'MARKET_STORE',
  SET_IN_STUDIO_BROADCAST_WEBHOOK_URL: 'BROADCAST', SET_IN_STUDIO_MARKET_PUBLISH_WEBHOOK_URL: 'MARKET_PUBLISH' };

/** The app's /api/data door, from the generated spec. */
function makeApp(seed = {}, { closed = false } = {}) {
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
    const stage = (from, r) => { const sc = E.status && E.status.column; if (!sc) return null; const to = r[sc]; if (!to) return null;
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
      if (bad(body)) return err(400, { error: 'invalid patch' }); if (enumBad(body)) return err(400, { ok: false });
      const merged = { ...cur, ...body }; const s = stage(cur[E.status?.column], merged); if (s) return err(400, { ok: false, errors: { stage: s } });
      if (dupOf(body, id)) return err(409, { ok: false });
      Object.assign(cur, body); return { status: 200, body: [{ ...cur }] };
    }
    return err(405, {});
  };
  return { app, db, jobs };
}

/** Run a flow; webhook POSTs to other flows are followed (depth-first, like the async chain in Studio). */
async function run(world, name, body, opts = {}) {
  const calls = []; const fakes = makeFakes({ app: world.app.app, calls, model: world.model, whatsapp: world.whatsapp });
  const r = await simulate(load(name, world.consts?.[name]), body, fakes);
  world.log.push({ name, body, ...r, calls });
  assert.deepEqual(r.failures, [], `${name}: ${r.failures.join(' | ')}`);
  if (String(load(name).template.trigger.settings.pieceName).endsWith('tool-webhook')) assert.ok(r.responses.length >= 1, `${name} ends in a Return`);
  if (!opts.noFollow) for (const c of calls) {
    const target = HOOKS[String(c.inputs.url)]; if (c.piece === 'http:send_request' && target) await run(world, target, c.inputs.body.data);
  }
  return r;
}
const newWorld = (seed, o = {}) => ({ app: makeApp(seed, o), log: [], model: o.model, whatsapp: o.whatsapp, consts: o.consts });
const T = istDate();
const SUBS = [
  { Subscriber_ID: 'SUB-2026-0001', Name: 'Amit Shah', WhatsApp: '+919876543210', Status: 'Active', Opt_In_At: '2026-08-01', Opt_In_Source: 'WhatsApp reply' },
  { Subscriber_ID: 'SUB-2026-0002', Name: 'Neha Iyer', WhatsApp: '+919820011223', Status: 'Active', Opt_In_At: '2026-08-04', Opt_In_Source: 'Web form' },
  { Subscriber_ID: 'SUB-2026-0003', Name: 'Rohit Verma', WhatsApp: '+919811122334', Status: 'Paused', Opt_In_At: '2026-08-20', Opt_In_Source: 'Signed form' },
];
const sends = (w) => w.log.flatMap((l) => l.calls).filter((c) => c.piece === 'pucho-whatsapp:send_template_message' && c.inputs.to);
const JOB = 'JOB-3F9A1C22B7E0';

test('MARKET_REPORT.run, end to end: report Ready → news with deterministic ids → template to each Active subscriber → Sent + counts + reader copy', async () => {
  const w = newWorld({ subscribers: SUBS });
  const r = await run(w, 'MARKET_REPORT', { action: 'run', Trigger: 'Manual', _who: 'Test', _job: JOB });
  assert.ok(r.trace.includes('step_router→Run (today\'s report)'));
  const [rep] = w.app.db.reports;
  assert.equal(rep.Report_Date, T); assert.equal(rep.Trigger, 'Manual'); assert.equal(rep.Sentiment, 'CAUTIOUSLY BULLISH'); assert.equal(rep.Confidence_Pct, 100);
  assert.equal(rep.Status, 'Sent'); assert.equal(rep.Sent_Count, 2); assert.equal(rep.Failed_Count, 0);
  assert.ok(rep.WhatsApp_Message.length <= 4000); assert.match(rep.Source_Status, /Reuters India 0 \(failed/);
  assert.equal(rep.View_Intraday, '', 'the stop-loss sentence never reached the row');
  assert.ok(w.app.db.news_articles.length > 0 && w.app.db.news_articles.every((a) => a.Article_ID.startsWith(`NWS-${rep.Report_ID}-`) && a.Report_ID === rep.Report_ID));
  const s = sends(w); assert.deepEqual(s.map((c) => c.inputs.to).sort(), ['+919820011223', '+919876543210'], 'Paused Rohit gets nothing');
  assert.ok(s.every((c) => c.inputs.template_id === 'SET_IN_STUDIO_TEMPLATE_ID_MI_DAILY_REPORT' && c.inputs.template_variables.sentiment === 'CAUTIOUSLY BULLISH'));
  assert.ok(w.app.db.deliveries.every((d) => d.Status === 'Sent' && d.Message_ID.startsWith('wamid.') && d.Kind === 'Report'));
  assert.equal(w.app.db.published_reports.length, 1); assert.equal(w.app.db.published_reports[0].Report_ID, rep.Report_ID);
  assert.ok(!('Error_Message' in w.app.db.published_reports[0]));
  assert.ok(w.app.db.subscribers.filter((x) => x.Status === 'Active').every((x) => x.Last_Delivered_At));
  assert.equal(w.app.jobs[JOB].status, 'done'); assert.equal(w.app.jobs[JOB].result.Status, 'Ready');
});

test('run when today\'s report exists: Ready / Sent → refused (job failed); Failed → re-run in place (PATCH)', async () => {
  const w = newWorld({ reports: [{ Report_ID: 'MIR-2026-0101', Report_Date: T, Status: 'Ready', Sentiment: 'BULLISH', Confidence_Level: 'HIGH', Driver_1: 'd', WhatsApp_Message: 'w' }] });
  await run(w, 'MARKET_REPORT', { action: 'run', Trigger: 'Schedule', _job: JOB });
  assert.equal(w.app.db.reports.length, 1); assert.equal(w.app.db.reports[0].Driver_1, 'd'); assert.equal(w.app.jobs[JOB].status, 'failed');
  assert.match(w.log.find((l) => l.name === 'MARKET_STORE').responses[0].error, /already exists/);
  const w2 = newWorld({ reports: [{ Report_ID: 'MIR-2026-0102', Report_Date: T, Status: 'Failed', Error_Message: 'timeout' }], subscribers: [] });
  await run(w2, 'MARKET_REPORT', { action: 'run', Trigger: 'Schedule' });
  assert.equal(w2.app.db.reports.length, 1); assert.equal(w2.app.db.reports[0].Status, 'Ready', 'no subscriber → nothing sent, stays Ready');
  assert.equal(w2.app.db.reports[0].Error_Message, '');
});

test('MARKET_REPORT.rerun: Failed → Ready on the same Report_ID; Sent / Ready refused; a repeat never doubles the news', async () => {
  const failed = { Report_ID: 'MIR-2026-0099', Report_Date: T, Status: 'Failed', Error_Message: 'No news', Created_At: new Date().toISOString() };
  const w = newWorld({ reports: [failed], subscribers: [] }, { model: MODEL.broken });
  await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: 'MIR-2026-0099', _job: JOB });
  assert.equal(w.app.db.reports[0].Status, 'Failed'); assert.match(w.app.db.reports[0].Error_Message, /^MODEL_JSON/);
  const n1 = w.app.db.news_articles.length; assert.ok(n1 > 0);
  w.model = undefined; await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: 'MIR-2026-0099' });
  assert.equal(w.app.db.reports[0].Status, 'Ready'); assert.equal(w.app.db.reports[0].Report_ID, 'MIR-2026-0099');
  assert.equal(w.app.db.news_articles.length, n1, 'same articles, same ids → not doubled');
  await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: 'MIR-2026-0099', _job: JOB });
  assert.equal(w.app.jobs[JOB].status, 'failed'); assert.match(w.app.jobs[JOB].result.error, /only a Failed report is re-run/);
  w.app.db.reports[0].Status = 'Sent';
  await run(w, 'MARKET_REPORT', { action: 'rerun', Report_ID: 'MIR-2026-0099', _job: JOB });
  assert.match(w.app.jobs[JOB].result.error, /never re-run/);
});

test('no news from any source → a Failed row and the mi_run_failed alert to each admin, nothing to subscribers (S6)', async () => {
  const w = newWorld({ subscribers: SUBS });
  const orig = makeFakes; w.app.app = ((a) => a)(w.app.app);
  const r = await simulate(load('MARKET_REPORT'), { action: 'run', Trigger: 'Schedule' }, async (piece, inputs, node) => { if (/^step_fetch_/.test(node.name)) throw new Error('HTTP 503: down'); return orig({})(piece, inputs, node); });
  assert.deepEqual(r.failures, []); assert.ok(r.trace.includes('step_router→No news → Failed row'));
  const storeCall = r.trace.includes('step_nonews_store(http:send_request)');
  assert.ok(storeCall);
  const body = (await (async () => { const calls = []; await simulate(load('MARKET_REPORT'), { action: 'run', Trigger: 'Schedule' }, async (p, i, n) => { calls.push({ p, i, n: n.name }); if (/^step_fetch_/.test(n.name)) throw new Error('HTTP 503'); return {}; }); return calls.find((c) => c.n === 'step_nonews_store').i.body.data; })());
  await run(w, 'MARKET_STORE', body);
  const [rep] = w.app.db.reports; assert.equal(rep.Status, 'Failed'); assert.match(rep.Error_Message, /^NO_NEWS/);
  const s = sends(w); assert.deepEqual(s.map((c) => c.inputs.to), ['+919800000001', '+919800000002']);
  assert.ok(s.every((c) => c.inputs.template_id === 'SET_IN_STUDIO_TEMPLATE_ID_MI_RUN_FAILED'));
  assert.ok(w.app.db.deliveries.every((d) => d.Kind === 'Alert' && d.Status === 'Sent'));
  assert.equal(w.app.db.published_reports.length, 0); assert.equal(rep.Sent_Count, undefined, 'a Failed report is never marked Sent');
});

test('BROADCAST.send twice: the second finds every delivery already there (409) and sends nothing', async () => {
  const rep = { Report_ID: 'MIR-2026-0101', Report_Date: T, Created_At: new Date(Date.now() - 60e3).toISOString(), Status: 'Ready', Sentiment: 'BULLISH', Confidence_Level: 'HIGH', Confidence_Pct: 74, Driver_1: 'FII inflows', WhatsApp_Message: 'w' };
  const w = newWorld({ reports: [rep], subscribers: SUBS });
  await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101', _job: JOB });
  assert.equal(sends(w).length, 2); assert.equal(w.app.db.reports[0].Status, 'Sent'); assert.equal(w.app.jobs[JOB].status, 'done');
  for (const s of w.app.db.subscribers) delete s.Last_Delivered_At;                  // force the 409 path, not the pre-filter
  const before = sends(w).length;
  await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101' });
  assert.equal(sends(w).length, before, '409 → skip: no second message'); assert.equal(w.app.db.deliveries.length, 2);
  assert.equal(w.app.db.reports[0].Sent_Count, 2);
});

test('BROADCAST.send: a WhatsApp failure is recorded Failed with the error; BROADCAST.retry sends it again to the record\'s number', async () => {
  const rep = { Report_ID: 'MIR-2026-0101', Report_Date: T, Created_At: new Date().toISOString(), Status: 'Ready', Sentiment: 'BULLISH', Confidence_Level: 'HIGH', Confidence_Pct: 74, Driver_1: 'FII inflows', WhatsApp_Message: 'w' };
  const w = newWorld({ reports: [rep], subscribers: SUBS }, { whatsapp: (i) => { if (i.to === '+919820011223') throw new Error('HTTP 400: 131026 Message undeliverable'); if (!i.to) throw new Error('to required'); return { messageId: 'wamid.OK' }; } });
  await run(w, 'BROADCAST', { action: 'send', Report_ID: 'MIR-2026-0101' });
  const bad = w.app.db.deliveries.find((d) => d.Subscriber_ID === 'SUB-2026-0002');
  assert.equal(bad.Status, 'Failed'); assert.match(bad.Error_Message, /131026/);
  assert.deepEqual([w.app.db.reports[0].Sent_Count, w.app.db.reports[0].Failed_Count], [1, 1]);
  w.whatsapp = undefined;
  const r = await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: bad.Delivery_ID, To: '+910000000000' });
  assert.equal(r.responses[0].sent, true); assert.equal(bad.Status, 'Sent');
  assert.equal(sends(w).at(-1).inputs.to, '+919820011223', 'the number on the subscriber record, never the payload');
  assert.deepEqual([w.app.db.reports[0].Sent_Count, w.app.db.reports[0].Failed_Count], [2, 0], 'MARKET_PUBLISH refreshed the counts');
  const again = await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: bad.Delivery_ID });
  assert.equal(again.responses[0].sent, false); assert.match(again.responses[0].error, /only a Failed report delivery/);
  w.app.db.subscribers[1].Status = 'Paused'; bad.Status = 'Failed';
  assert.equal((await run(w, 'BROADCAST', { action: 'retry', Delivery_ID: bad.Delivery_ID })).responses[0].sent, false);
});

test('closed door (403, INBOUND_TOKEN unset): MARKET_STORE refuses with APP_CLOSED; the watchdog still alerts', async () => {
  const w = newWorld({}, { closed: true });
  const r = await run(w, 'MARKET_STORE', { action: 'store', Mode: 'run', report: { Status: 'Failed', Error_Message: 'x' }, articles: [] });
  assert.equal(r.responses[0].code, 'APP_CLOSED');
  const wd = await run(w, 'DAILY_WATCHDOG', {}, { noFollow: true });
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());
  if (!['Sat', 'Sun'].includes(day)) assert.ok(wd.trace.includes('step_router→No report row — alert the admins'));
});

test('DAILY_SCHEDULE → MARKET_REPORT {action: run, Trigger: Schedule}; an NSE holiday skips; DAILY_WATCHDOG alerts only without a row', async () => {
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());
  const w = newWorld({ subscribers: [] });
  const r = await run(w, 'DAILY_SCHEDULE', {}, { noFollow: true });
  const post = w.log[0].calls.find((c) => c.node === 'step_run_post');
  if (['Sat', 'Sun'].includes(day)) assert.equal(post, undefined);
  else { assert.deepEqual(post.inputs.body.data, { action: 'run', Trigger: 'Schedule', _who: 'flow:DAILY_SCHEDULE' }); assert.equal(post.inputs.url, 'SET_IN_STUDIO_MARKET_REPORT_WEBHOOK_URL'); }
  const h = newWorld({}, { consts: { DAILY_SCHEDULE: { holidays: [T] } } });
  await run(h, 'DAILY_SCHEDULE', {}, { noFollow: true });
  assert.equal(h.log[0].calls.find((c) => c.node === 'step_run_post'), undefined, 'holiday → no run');
  const ok = newWorld({ reports: [{ Report_ID: 'MIR-2026-0101', Report_Date: T, Status: 'Failed', Error_Message: 'x' }] });
  const wd = await run(ok, 'DAILY_WATCHDOG', {}, { noFollow: true });
  assert.ok(wd.trace.includes('step_router→Report row present'));
  if (!['Sat', 'Sun'].includes(day)) {
    const miss = newWorld({ subscribers: [] }); await run(miss, 'DAILY_WATCHDOG', {});
    assert.deepEqual(sends(miss).map((c) => c.inputs.to), ['+919800000001', '+919800000002']);
    assert.match(sends(miss)[0].inputs.template_variables.error, /No report row by 06:20/);
  }
  assert.ok(r);
});

test('unknown actions answer 400; every flow file is free of secrets and of free-text WhatsApp (S5, S7)', async () => {
  for (const f of ['MARKET_REPORT', 'BROADCAST']) {
    const r = await run(newWorld({}), f, { action: 'drop_everything' }, { noFollow: true });
    assert.equal(r.responses[0].ok, false);
  }
  for (const f of ['DAILY_SCHEDULE', 'DAILY_WATCHDOG', 'MARKET_REPORT', 'MARKET_STORE', 'BROADCAST', 'MARKET_PUBLISH']) {
    const text = fs.readFileSync(path.join(ROOT, 'workflows', f, `${f}.json`), 'utf8');
    assert.doesNotMatch(text, /Bearer (?!\{\{)/, `${f}: a literal bearer token`);
    assert.doesNotMatch(text, /send_text_message|graph\.facebook\.com|api\.groq\.com/, `${f}: free text or a direct provider call`);
    assert.doesNotMatch(text, /"cronExpression": "0 30 0/, `${f}: the S1 cron`);
  }
  const sched = load('DAILY_SCHEDULE').template.trigger.settings;
  assert.deepEqual([sched.triggerName, sched.input.hour_of_the_day, sched.input.timezone, sched.input.run_on_weekends], ['every_day', '6', 'Asia/Kolkata', false]);
});
