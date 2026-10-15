// tests/db/verify.mjs — repeatable data-layer verification for Market Intelligence (database agent, step 7 review).
// Proves over HTTP, against a RUNNING app, that the generated data layer enforces os.yaml: role → entity access (subscriber
// reads only published_reports + news_articles), admin-only actions, the v4.9 validation grammar on the Server Action write
// path (direct patch / insert and the simulated flow effects) and — when DOOR_BASE_URL + DOOR_TOKEN name an instance started
// with an inbound token — on the /api/data flow door. Fixture rows use year 2099 ids / dates and are deleted at the end.
//
//   node tests/db/verify.mjs                                  # CHECK_BASE_URL defaults to http://localhost:5000
//   DOOR_BASE_URL=http://127.0.0.1:5055 DOOR_TOKEN=… node tests/db/verify.mjs
//
// Each line is PASS / FAIL / NOTE. FAIL = the build does not enforce the design (a finding), not a script error. Exit 1 on any FAIL.
// The session cookie is never printed.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { sql } from './sql.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url)); const APP = path.resolve(HERE, '..', '..', 'app');
const BASE = (process.env.CHECK_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const DOOR = (process.env.DOOR_BASE_URL || '').replace(/\/$/, ''); const TOKEN = process.env.DOOR_TOKEN || '';
const results = []; const log = (kind, id, msg) => { results.push({ kind, id, msg }); console.log(`${kind.padEnd(4)} ${id.padEnd(5)} ${msg}`); };
const check = (id, cond, msg, detail = '') => log(cond ? 'PASS' : 'FAIL', id, msg + (cond || !detail ? '' : ` — got ${detail}`));
const note = (id, msg) => log('NOTE', id, msg);

// ── Server Action calls (the IDs are read from the build the server runs) ──
const manifest = JSON.parse(fs.readFileSync(path.join(APP, '.next', 'server', 'server-reference-manifest.json'), 'utf8'));
const actionId = (name) => Object.entries(manifest.node).find(([, v]) => v.exportedName === name)?.[0];
async function retry(fn) { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (i >= 10 || !/ECONNREFUSED|fetch failed|ECONNRESET/.test(String(e?.cause?.code || e?.message))) throw e; await new Promise((r) => setTimeout(r, 3000)); } } }
async function act(cookie, name, arg, at = '/today') {
  const id = actionId(name); if (!id) throw new Error(`no server action ${name} in the manifest`);
  const res = await retry(() => fetch(BASE + at, { method: 'POST', redirect: 'manual', headers: { 'Next-Action': id, Accept: 'text/x-component', 'Content-Type': 'text/plain;charset=UTF-8', Origin: BASE, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(arg === undefined ? [] : [arg]) }));
  const text = await res.text(); const lines = text.split('\n');
  const head = lines.find((l) => l.startsWith('0:')); let ref = null;
  try { ref = JSON.parse(head.slice(2)).a; } catch { /* not an RSC answer */ }
  const n = typeof ref === 'string' && ref.startsWith('$@') ? ref.slice(2) : null;
  const line = n ? lines.find((l) => l.startsWith(`${n}:`)) : null;
  let value = null; if (line) { const raw = line.slice(n.length + 1); try { value = JSON.parse(raw.startsWith('E') ? raw.slice(1) : raw); } catch { value = raw; } }
  return { status: res.status, value, thrown: !!line && line.slice(n.length + 1).startsWith('E'), setCookie: res.headers.get('set-cookie') || '' };
}
async function login(role) {
  const r = await act('', 'signInAsPersona', { role }, '/login');
  const m = /(?:^|,\s*)((?:__Host-)?session)=([^;]+)/.exec(r.setCookie);
  if (!r.value?.ok || !m) throw new Error(`demo sign-in as ${role} failed (DEMO_LOGINS=true needed): ${JSON.stringify(r.value)}`);
  return `${m[1]}=${m[2]}`;
}
const get = (cookie, p) => retry(() => fetch(BASE + p, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} }));
const run = (cookie, pageId, spec, payload) => act(cookie, 'runAction', { pageId, spec, payload }).then((r) => r.value ?? {});

// ── fixtures (year 2099 so they never collide with the seed or the id counter, which numbers inside the current year) ──
const CREATED = [];   // ids the simulated run created — deleted at the end, nothing else
const FX = { ready: 'MIR-2099-9001', failed: 'MIR-2099-9002', sent: 'MIR-2099-9003', sub: 'SUB-2099-9001', dlv: 'DLV-2099-9001' };
const REQ = { sentiment: 'NEUTRAL', confidence_level: 'LOW', driver_1: 'ZZTEST driver', whatsapp_message: 'ZZTEST message' };
async function setup() {
  await cleanup();
  const ins = (id, date, status, extra) => sql(`INSERT INTO reports (report_id, report_date, created_at, trigger, status, sentiment, confidence_level, confidence_pct, driver_1, whatsapp_message, error_message, sent_count)
    VALUES ($1, $2, now(), 'Manual', $3, $4, $5, 10, $6, $7, $8, 0)`, [id, date, status, extra.sentiment ?? '', extra.confidence_level ?? '', extra.driver_1 ?? '', extra.whatsapp_message ?? '', extra.error_message ?? '']);
  await ins(FX.ready, '2099-01-01', 'Ready', REQ);
  await ins(FX.failed, '2099-01-02', 'Failed', { error_message: 'ZZTEST failure' });
  await ins(FX.sent, '2099-01-03', 'Sent', REQ);
  await sql(`INSERT INTO subscribers (subscriber_id, name, whatsapp, status, opt_in_at, opt_in_source, joined_at) VALUES ($1, 'ZZTEST Unsub', '+919000099001', 'Unsubscribed', '2099-01-01', 'Web form', now())`, [FX.sub]);
  await sql(`INSERT INTO deliveries (delivery_id, sent_at, kind, report_id, report_date, subscriber_id, subscriber_name, status, error_message) VALUES ($1, now(), 'Report', $2, '2099-01-03', 'SUB-2026-0001', 'Amit Shah', 'Failed', 'ZZTEST')`, [FX.dlv, FX.sent]);
}
async function cleanup() {
  await sql(`DELETE FROM deliveries WHERE delivery_id LIKE 'DLV-2099-%' OR report_date >= '2099-01-01' OR error_message LIKE 'ZZTEST%'`);
  await sql(`DELETE FROM published_reports WHERE report_id LIKE 'MIR-2099-%' OR report_date >= '2099-01-01'`);
  await sql(`DELETE FROM reports WHERE report_id LIKE 'MIR-2099-%' OR report_date >= '2099-01-01' OR driver_1 LIKE 'ZZTEST%' OR report_id = ANY($1)`, [CREATED]);
  await sql(`DELETE FROM subscribers WHERE subscriber_id LIKE 'SUB-2099-%' OR name LIKE 'ZZTEST%'`);
  await sql(`DELETE FROM audit_log WHERE record_id LIKE '%-2099-%' OR summary LIKE '%ZZTEST%' OR who LIKE 'ZZTEST%' OR record_id = ANY($1)`, [CREATED]);
}
const rep = async (id) => (await sql('SELECT status, sent_count::text, report_date::text, confidence_pct::text, driver_1 FROM reports WHERE report_id = $1', [id]))[0];

// ── 1. subscriber: only published_reports + news_articles ──
async function subscriberScope() {
  const c = await login('subscriber');
  for (const p of ['/', '/today', '/reports', '/subscribers', '/deliveries', '/activity', '/pipeline', '/news']) {
    const r = await get(c, p); const body = r.status === 200 ? await r.text() : '';
    const loc = r.headers.get('location') || '';
    check('1.1', r.status === 404 || (r.status >= 300 && r.status < 400 && /\/me(\b|$)/.test(loc)), `subscriber GET ${p} → redirect to /me or 404`, `${r.status} ${loc} ${body.length}b`);
  }
  // pages the subscriber can open: nothing that exists only on reports / subscribers / deliveries / audit_log
  const banned = [/"Error_Message"/, /"Source_Status"/, /"Sent_Count"/, /"Failed_Count"/, /"Category_Breakdown"/, /"Trigger":"(Schedule|Manual)"/, /"Status":"(Ready|Sent|Failed|Active|Paused|Unsubscribed|Queued)"/, /"Subscriber_ID"/, /"Delivery_ID"/, /"Audit_ID"/, /SUB-20\d\d-\d{4}/, /DLV-20\d\d-\d{4}/, /\+91\d{10}/, /\+91 ?\d{5} ?\d{5}/];
  for (const p of ['/me', '/me/reports']) {
    const r = await get(c, p); const body = await r.text();
    check('1.2', r.status === 200, `subscriber GET ${p} → 200`, String(r.status));
    const hits = banned.filter((re) => re.test(body)).map(String);
    check('1.3', hits.length === 0, `${p} payload carries no reports-only field, no subscriber/delivery/audit id, no phone number`, hits.join(' '));
    const rsc = await retry(() => fetch(BASE + p, { headers: { Cookie: c, RSC: '1' } })).then((x) => x.text());
    const hits2 = banned.filter((re) => re.test(rsc)).map(String);
    check('1.3', hits2.length === 0, `${p} RSC payload carries no reports-only field or phone`, hits2.join(' '));
    // published_reports that are NOT Sent in reports (a failed/draft run on the reader page)
    if (p === '/me/reports') {
      const notSent = await sql(`SELECT p.report_id FROM published_reports p JOIN reports r USING (report_id) WHERE r.status <> 'Sent'`);
      const shown = notSent.filter((x) => body.includes(x.report_id) || rsc.includes(x.report_id)).map((x) => x.report_id);
      check('1.4', shown.length === 0, 'reader page shows only reports whose desk copy is Sent', `${shown.length} published copies of Ready/Failed reports: ${shown.slice(0, 4).join(', ')}`);
    }
  }
  for (const ent of ['reports', 'deliveries', 'subscribers', 'audit_log', 'users', 'sessions']) {
    const r = await act(c, 'readEntity', { entity: ent }, '/me');
    check('1.5', r.value && r.value.ok === false, `subscriber readEntity(${ent}) refused`, JSON.stringify(r.value).slice(0, 80));
  }
  for (const ent of ['published_reports', 'news_articles']) { const r = await act(c, 'readEntity', { entity: ent }, '/me'); check('1.5', r.value?.ok === true, `subscriber readEntity(${ent}) allowed (${r.value?.rows?.length ?? 0} rows)`); }
  const w1 = await run(c, 'me_today', { direct: 'patch', entity: 'reports' }, { Report_ID: FX.ready, Sentiment: 'BEARISH' });
  check('1.6', w1.ok === false && (await rep(FX.ready)).status === 'Ready', 'subscriber direct patch of reports refused', JSON.stringify(w1));
  const w2 = await run(c, 'me_today', { flow: 'BROADCAST', action: 'send' }, { Report_ID: FX.ready });
  check('1.6', w2.ok === false, 'subscriber BROADCAST.send refused', JSON.stringify(w2));
  const w3 = await run(c, 'me_today', { direct: 'insert', entity: 'published_reports' }, { Report_Date: '2099-02-01', Sentiment: 'BULLISH' });
  check('1.6', w3.ok === false, 'subscriber direct insert of published_reports refused', JSON.stringify(w3));
  for (const p of ['/api/data/reports', '/api/data/subscribers', '/api/data/audit_log']) { const r = await get(c, p); check('1.7', r.status === 403, `subscriber cookie on ${p} → 403 (door needs the inbound token)`, String(r.status)); }
  const job = await sql(`SELECT id FROM jobs ORDER BY created_at DESC LIMIT 1`);
  if (job[0]) { const r = await get(c, `/api/jobs/${job[0].id}`); note('1.8', `subscriber GET /api/jobs/<id> → ${r.status} (any signed-in role may read any job's status/result)`); }
  const lu = await act(c, 'listUsers', undefined, '/settings'); check('1.9', lu.thrown || lu.value?.ok !== true, 'subscriber listUsers refused');
}

// ── 2. analyst: no /activity, no Users & roles, no audit_log ──
async function analystLimits() {
  const c = await login('analyst');
  const r = await get(c, '/activity'); check('2.1', r.status === 404 || (r.status >= 300 && r.status < 400 && !/activity/.test(r.headers.get('location') || '')), 'analyst GET /activity → redirect/404', `${r.status} ${r.headers.get('location')}`);
  const a = await act(c, 'readEntity', { entity: 'audit_log' }); check('2.2', a.value?.ok === false, 'analyst readEntity(audit_log) refused', JSON.stringify(a.value).slice(0, 80));
  const lu = await act(c, 'listUsers', undefined, '/settings'); check('2.3', lu.thrown || lu.value?.ok !== true, 'analyst listUsers refused', JSON.stringify(lu.value).slice(0, 80));
  const cu = await act(c, 'createUser', { name: 'ZZTEST', email: 'zztest@example.in', role: 'admin' }, '/settings'); check('2.3', cu.thrown || cu.value?.ok !== true, 'analyst createUser(admin) refused', JSON.stringify(cu.value).slice(0, 80));
  const sr = await act(c, 'setUserRole', { id: 'USR-ANALYST', role: 'admin' }, '/settings'); check('2.3', sr.thrown || sr.value?.ok !== true, 'analyst setUserRole(self → admin) refused');
  const role = await sql(`SELECT role FROM users WHERE email = 'analyst@marketintel.pucho.ai'`); check('2.3', role[0]?.role === 'analyst', 'analyst is still analyst afterwards', role[0]?.role);
  await sql(`DELETE FROM users WHERE email = 'zztest@example.in'`);
  return c;
}

// ── 3. v4.9 validation on the Server Action path (direct writes + simulated flow effects) ──
async function serverActionValidation(c) {
  const P = (patch) => run(c, 'reports', { direct: 'patch', entity: 'reports' }, patch);
  let r;
  r = await P({ Report_ID: FX.sent, Status: 'Ready' });  check('3.1', r.ok === false && r.errors?.Status, 'reports Sent → Ready refused (400-equivalent, field Status)', JSON.stringify(r));
  r = await P({ Report_ID: FX.failed, Status: 'Sent' }); check('3.1', r.ok === false && r.errors?.Status, 'reports Failed → Sent refused', JSON.stringify(r));
  r = await P({ Report_ID: FX.ready, Driver_1: '' });      check('3.2', r.ok === false && r.errors?.Driver_1, 'Ready report cannot lose Driver_1 (requires_on)', JSON.stringify(r));
  r = await P({ Report_ID: FX.failed, Status: 'Ready' });  check('3.2', r.ok === false && r.errors?.Sentiment, 'Failed → Ready without Sentiment/Driver_1/WhatsApp_Message refused (requires_on)', JSON.stringify(r));
  r = await P({ Report_ID: FX.ready, Confidence_Pct: 101 }); check('3.3', r.ok === false && r.errors?.Confidence_Pct, 'Confidence_Pct 101 refused', JSON.stringify(r));
  r = await P({ Report_ID: FX.ready, Confidence_Pct: 50.5 }); check('3.3', r.ok === false && r.errors?.Confidence_Pct, 'Confidence_Pct 50.5 refused (integer)', JSON.stringify(r));
  r = await P({ Report_ID: FX.ready, Confidence_Pct: -1 });  check('3.3', r.ok === false && r.errors?.Confidence_Pct, 'Confidence_Pct -1 refused', JSON.stringify(r));
  r = await P({ Report_ID: FX.ready, Sentiment: 'VERY BULLISH' }); check('3.4', r.ok === false && r.errors?.Sentiment, 'Sentiment outside one_of refused', JSON.stringify(r));
  r = await P({ Report_ID: FX.ready, Report_Date: '2099-01-03' }); check('3.5', r.ok === false && r.code === 'DUPLICATE', 'patching Report_Date onto another report’s date → DUPLICATE (409-equivalent)', JSON.stringify(r));
  const before = await rep(FX.ready);
  check('3.0', before.status === 'Ready' && before.confidence_pct === '10' && before.report_date === '2099-01-01', 'every refused write left the Ready fixture unchanged', JSON.stringify(before));
  // mass assignment: the review modal declares 7 fields; the server accepts any column of the entity for direct:patch:reports
  r = await P({ Report_ID: FX.ready, Status: 'Sent', Sent_Count: 9999 });
  const after = await rep(FX.ready);
  check('3.6', !(r.ok && after.status === 'Sent'), 'direct patch limited to the modal’s fields (Status/Sent_Count not settable from Review & edit)', `ok=${r.ok}, row now Status=${after.status} Sent_Count=${after.sent_count} — a report marked Sent with no broadcast`);
  await sql(`UPDATE reports SET status = 'Ready', sent_count = 0 WHERE report_id = $1`, [FX.ready]);
  // reports have no insert action for any role
  r = await run(c, 'reports', { direct: 'insert', entity: 'reports' }, { Report_Date: '2099-03-01', Status: 'Ready', ...{ Sentiment: 'NEUTRAL', Confidence_Level: 'LOW', Driver_1: 'ZZTEST', WhatsApp_Message: 'x' } });
  check('3.7', r.ok === false && /Not allowed/.test(r.error || ''), 'analyst direct insert of reports refused (no such action)', JSON.stringify(r));

  // subscribers (direct:insert / direct:patch)
  const S = (row) => run(c, 'subscribers', { direct: 'insert', entity: 'subscribers' }, row);
  const base = { Name: 'ZZTEST Sub', Opt_In_At: '2099-01-01', Opt_In_Source: 'Web form', Status: 'Active' };
  r = await S({ ...base, WhatsApp: '12345' });            check('3.8', r.ok === false && r.errors?.WhatsApp, 'WhatsApp "12345" refused (phone format)', JSON.stringify(r));
  r = await S({ ...base, WhatsApp: '+919876543210' });    check('3.9', r.ok === false && r.code === 'DUPLICATE', 'WhatsApp of SUB-2026-0001 refused as duplicate', JSON.stringify(r));
  r = await S({ ...base, Name: 'ZZTEST Dup spaced', WhatsApp: '+91 98765 43210' }); check('3.10', r.ok === false && r.code === 'DUPLICATE', 'the same number typed "+91 98765 43210" refused as duplicate', `ok=${r.ok} id=${r.Subscriber_ID ?? ''} (stored un-normalised; two rows → two WhatsApps to one person)`);
  r = await S({ ...base, Name: 'ZZTEST Dup local', WhatsApp: '9876543210' });       check('3.10', r.ok === false && r.code === 'DUPLICATE', 'the same number without +91 refused as duplicate', `ok=${r.ok} id=${r.Subscriber_ID ?? ''}`);
  r = await S({ ...base, WhatsApp: '+919000099002', Opt_In_At: '' }); check('3.11', r.ok === false && r.errors?.Opt_In_At, 'Active without Opt_In_At refused (requires_on)', JSON.stringify(r));
  r = await S({ ...base, WhatsApp: '+919000099003', Opt_In_Source: 'Email' }); check('3.12', r.ok === false && r.errors?.Opt_In_Source, 'Opt_In_Source outside one_of refused', JSON.stringify(r));
  r = await S({ ...base, WhatsApp: '+919000099004', Opt_In_At: '2026-02-30' }); check('3.12', r.ok === false && r.errors?.Opt_In_At, 'Opt_In_At 2026-02-30 refused (not a date)', JSON.stringify(r));
  r = await S({ ...base, WhatsApp: '+919000099005', Email: 'not-an-email' }); check('3.12', r.ok === false && r.errors?.Email, 'Email "not-an-email" refused', JSON.stringify(r));
  r = await S({ ...base, Name: 'ZZTEST Bogus status', WhatsApp: '+919000099006', Status: 'Deleted' }); check('3.13', r.ok === false, 'Status "Deleted" (not a declared status) refused on insert', `ok=${r.ok} id=${r.Subscriber_ID ?? ''} — the row is stuck: transitions["Deleted"] = []`);
  r = await run(c, 'subscribers', { direct: 'patch', entity: 'subscribers' }, { Subscriber_ID: FX.sub, Status: 'Active' }); check('3.14', r.ok === false && r.errors?.Status, 'Unsubscribed → Active refused (final)', JSON.stringify(r));
  r = await run(c, 'subscribers', { direct: 'patch', entity: 'subscribers' }, { Subscriber_ID: FX.sub, Status: 'Paused' }); check('3.14', r.ok === false && r.errors?.Status, 'Unsubscribed → Paused refused (final)', JSON.stringify(r));
  r = await run(c, 'subscribers', { direct: 'patch', entity: 'subscribers' }, { Subscriber_ID: 'SUB-2026-0002', WhatsApp: '+919876543210' }); check('3.9', r.ok === false && r.code === 'DUPLICATE', 'edit_subscriber onto another subscriber’s number → DUPLICATE', JSON.stringify(r));

  // simulated flow effects (no WEBHOOK_* set): MARKET_REPORT.run, BROADCAST.send, BROADCAST.retry
  r = await run(c, 'today', { flow: 'MARKET_REPORT', action: 'run' }, { Trigger: 'Manual' });
  const newId = r.Report_ID; if (newId) CREATED.push(newId); const nr = newId ? await rep(newId) : null;
  check('3.15', r.ok === true && r.simulated === true && nr?.status === 'Ready', `MARKET_REPORT.run (simulated) inserts a valid Ready report (${newId ?? 'none'})`, JSON.stringify(r).slice(0, 160));
  check('3.16', !!nr?.report_date, 'the simulated run’s report has a Report_Date (Today’s table filters on it; the unique rule needs it)', `Report_Date=${nr?.report_date ?? 'null'}`);
  const rr = await run(c, 'pipeline', { flow: 'MARKET_REPORT', action: 'run', entity: 'reports' }, { Report_ID: FX.failed });
  const fAfter = await rep(FX.failed);
  check('3.17', !(rr.ok === true && fAfter.status === 'Failed'), 'Re-run on a Failed report either re-runs it or says it did not', `answered ok=${rr.ok} "${(rr.Status ?? '')}" yet the row is still ${fAfter.status} (insert ON CONFLICT DO NOTHING — a silent no-op)`);
  r = await run(c, 'today', { flow: 'BROADCAST', action: 'send', entity: 'reports' }, { Report_ID: FX.failed }); check('3.18', r.ok === false && r.errors?.Status, 'BROADCAST.send on a Failed report refused (Failed → Sent)', JSON.stringify(r));
  r = await run(c, 'today', { flow: 'BROADCAST', action: 'send', entity: 'reports' }, { Report_ID: FX.ready });
  const sAfter = await rep(FX.ready); check('3.19', r.ok === true && sAfter.status === 'Sent', 'BROADCAST.send (simulated) moves a Ready report to Sent through the guards', JSON.stringify(r).slice(0, 120));
  const pub = await sql('SELECT 1 FROM published_reports WHERE report_id = $1', [FX.ready]);
  check('3.20', pub.length === 1, 'a sent report reaches the reader portal (published_reports row written)', 'no published_reports row — the simulated effect only patches reports, so /me never shows a report the desk sends');
  r = await run(c, 'today', { flow: 'BROADCAST', action: 'send', entity: 'reports' }, { Report_ID: FX.sent, Sent_Count: -5 });
  check('3.21', r.ok === false && r.errors?.Sent_Count, 'a flow payload value is still guarded (Sent_Count -5 refused)', JSON.stringify(r).slice(0, 120));
  r = await run(c, 'deliveries', { flow: 'BROADCAST', action: 'retry', entity: 'deliveries' }, { Delivery_ID: FX.dlv });
  const d = (await sql('SELECT status, error_message FROM deliveries WHERE delivery_id = $1', [FX.dlv]))[0];
  check('3.22', r.ok === true && d?.status === 'Sent' && d?.error_message === '', 'BROADCAST.retry (simulated) Failed → Sent, error cleared', JSON.stringify(d));
  r = await run(c, 'deliveries', { flow: 'BROADCAST', action: 'retry', entity: 'deliveries' }, { Delivery_ID: FX.dlv, Status: 'Queued' });
  check('3.22', (await sql('SELECT status FROM deliveries WHERE delivery_id = $1', [FX.dlv]))[0]?.status === 'Sent', 'retry cannot move a Sent delivery back (fill wins over payload Status)');
}

// ── 4. the flow door ──
async function door() {
  const d = (p, init = {}) => retry(() => fetch((init.base ?? BASE) + p, init));
  let r = await d('/api/data/reports'); check('4.1', r.status === 403, 'GET /api/data/reports with no token → 403 "closed" (kernel answers 403, not 401)', String(r.status));
  r = await d('/api/data/reports', { headers: { Authorization: 'Bearer wrong-token-0000000000000000000000' } }); check('4.1', r.status === 403, 'wrong token → 403', String(r.status));
  r = await d('/api/data/reports', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '[{}]' }); check('4.1', r.status === 403, 'POST with no token → 403 before the body is read', String(r.status));
  if (!DOOR || !TOKEN) { note('4.2', 'door body/validation checks skipped — set DOOR_BASE_URL + DOOR_TOKEN (an instance started with INBOUND_TOKEN)'); return; }
  const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'X-Flow': 'verify' };
  const D = (p, method, body, headers = H) => d(p, { base: DOOR, method, headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  r = await D('/api/data/reports', 'POST', '[{}]', { ...H, 'Content-Type': 'text/plain' }); check('4.2', r.status === 415, 'Content-Type text/plain → 415', String(r.status));
  r = await D('/api/data/reports', 'POST', '[{"Driver_1":"' + 'a'.repeat(300 * 1024) + '"}]'); check('4.2', r.status === 413, '300 KB body → 413', String(r.status));
  const noCt = { Authorization: `Bearer ${TOKEN}` };
  r = await d('/api/data/reports', { base: DOOR, method: 'POST', headers: noCt, body: new Blob([JSON.stringify([{ Report_ID: 'MIR-2099-9100', Report_Date: '2099-04-01', Status: 'Failed', Error_Message: 'ZZTEST no ct' }])]) });
  check('4.2', r.status === 415, 'a body with NO Content-Type → 415 (JSON only)', `${r.status} — readJson lets an empty Content-Type through`);
  r = await d('/api/data/reports', { base: DOOR, headers: { Authorization: `Bearer ${TOKEN}` } }); const rows = r.status === 200 ? await r.json() : [];
  check('4.3', r.status === 200 && rows.length > 0, `GET /api/data/reports with the token → ${rows.length} rows`, String(r.status));
  const Rok = { Report_ID: 'MIR-2099-9101', Trigger: 'Schedule', Sentiment: 'NEUTRAL', Confidence_Level: 'LOW', Driver_1: 'ZZTEST', WhatsApp_Message: 'ZZTEST', Status: 'Ready' };
  r = await D('/api/data/reports', 'POST', [{ ...Rok, Report_Date: '2099-01-01' }]); check('4.4', r.status === 409, 'POST report on an existing Report_Date → 409', `${r.status} ${await r.text()}`);
  r = await D('/api/data/reports', 'POST', [{ ...Rok, Report_Date: '2099-05-01', Confidence_Pct: 150 }]); check('4.5', r.status === 400, 'Confidence_Pct 150 → 400', String(r.status));
  r = await D('/api/data/reports', 'POST', [{ ...Rok, Report_Date: '2099-05-01', Confidence_Pct: 12.5 }]); check('4.5', r.status === 400, 'Confidence_Pct 12.5 → 400', String(r.status));
  r = await D('/api/data/reports', 'POST', [{ ...Rok, Report_Date: '2099-05-01', WhatsApp_Message: '' }]); check('4.6', r.status === 400, 'Ready without WhatsApp_Message → 400 (requires_on)', String(r.status));
  r = await D('/api/data/reports', 'POST', [{ ...Rok, Report_Date: '2099-05-01', FnO_View: 'BUY CALLS' }]); check('4.7', r.status === 400, 'FnO_View "BUY CALLS" → 400 (one_of; SEBI wording)', String(r.status));
  r = await D('/api/data/reports', 'POST', [{ ...Rok, Report_Date: '2099-05-01', Status: 'Draft' }]); check('4.8', r.status === 400, 'Status "Draft" (undeclared) → 400', `${r.status} — accepted: status values are not a one_of guard on insert`);
  r = await D('/api/data/reports', 'POST', [{ ...Rok, Report_Date: '2099-05-02', Unknown_Col: 'x' }]); check('4.9', r.status === 400, 'an undeclared column → 400 (strict rows)', String(r.status));
  r = await D(`/api/data/reports?Report_ID=eq.${FX.sent}`, 'PATCH', { Status: 'Ready' }); check('4.10', r.status === 400, 'PATCH Sent → Ready → 400', String(r.status));
  r = await D(`/api/data/reports?Report_ID=eq.${FX.failed}`, 'PATCH', { Status: 'Sent' }); check('4.10', r.status === 400, 'PATCH Failed → Sent → 400', String(r.status));
  r = await D(`/api/data/reports?Report_ID=eq.${FX.failed}`, 'PATCH', { Status: 'Ready', ...{ Sentiment: 'NEUTRAL', Confidence_Level: 'LOW', Driver_1: 'ZZTEST re-run', WhatsApp_Message: 'ZZTEST' } }); check('4.10', r.status === 200, 'PATCH Failed → Ready with the required fields → 200 (the real re-run path)', String(r.status));
  r = await D(`/api/data/subscribers?Subscriber_ID=eq.${FX.sub}`, 'PATCH', { Status: 'Active' }); check('4.11', r.status === 400, 'PATCH subscriber Unsubscribed → Active → 400', String(r.status));
  r = await D('/api/data/subscribers', 'POST', [{ Name: 'ZZTEST door', WhatsApp: '98-765-432', Status: 'Paused' }]); check('4.12', r.status === 400, 'subscriber WhatsApp "98-765-432" → 400', String(r.status));
  r = await D('/api/data/subscribers', 'POST', [{ Name: 'ZZTEST door', WhatsApp: '+919820011223', Status: 'Paused' }]); check('4.12', r.status === 409, 'subscriber duplicate WhatsApp → 409', String(r.status));
  r = await D('/api/data/subscribers', 'POST', [{ Name: 'ZZTEST door', WhatsApp: '+919000099010', Status: 'Active' }]); check('4.13', r.status === 400, 'Active subscriber without opt-in → 400', String(r.status));
  const dl = { Kind: 'Report', Report_ID: FX.sent, Report_Date: '2099-01-03', Subscriber_ID: 'SUB-2026-0001', Subscriber_Name: 'Amit Shah', Status: 'Queued' };
  r = await D('/api/data/deliveries', 'POST', [dl]); check('4.14', r.status === 409, 'delivery duplicate (Report_Date, Subscriber_ID, Kind) → 409', `${r.status} ${await r.text()}`);
  r = await D('/api/data/deliveries', 'POST', [{ ...dl, Kind: 'Alert' }]); check('4.14', r.status === 201, 'same report + subscriber, Kind Alert → 201 (different composite key)', String(r.status));
  r = await D('/api/data/deliveries', 'POST', [{ ...dl, Kind: 'SMS', Subscriber_ID: 'SUB-2026-0002' }]); check('4.15', r.status === 400, 'delivery Kind "SMS" → 400', String(r.status));
  r = await D(`/api/data/deliveries?Delivery_ID=eq.${FX.dlv}`, 'PATCH', { Status: 'Queued' }); check('4.16', r.status === 400, 'PATCH delivery Sent → Queued → 400', String(r.status));
  r = await D('/api/data/audit_log', 'POST', [{ Who: 'ZZTEST forged', Action: 'delete' }]); check('4.17', r.status !== 201, 'a flow cannot forge audit_log rows through the door', `${r.status} — audit_log is an entity, so the door inserts into it`);
  r = await D('/api/data/users', 'POST', [{ email: 'x' }]); check('4.17', r.status === 404, 'users is not reachable through the door → 404', String(r.status));
}

// ── 5. RLS / roles in the database ──
async function database() {
  const rls = fs.readFileSync(path.join(APP, 'db', 'rls.sql'), 'utf8');
  const pol = await sql('SELECT count(*)::int AS n FROM pg_policies'); const on = await sql(`SELECT relname FROM pg_class WHERE relrowsecurity AND relname IN ('reports','published_reports','news_articles','subscribers','deliveries','audit_log')`);
  note('5.1', `db/rls.sql: ${rls.split('\n').filter((l) => l.trim() && !l.startsWith('--')).length} statements ("${rls.trim().slice(0, 90)}…"); pg_policies=${pol[0].n}; tables with RLS on: ${on.length}`);
  const who = await sql('SELECT current_user AS u, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS su'); note('5.2', `dev app connects as ${who[0].u} (superuser=${who[0].su}) — RLS and the app role are bypassed locally`);
  const g = await sql(`SELECT table_name FROM information_schema.role_table_grants WHERE grantee = 'studio_reader' ORDER BY 1`); note('5.3', `studio_reader SELECT grants: ${[...new Set(g.map((x) => x.table_name))].join(', ')}`);
  const ug = await sql(`SELECT count(*)::int AS n FROM information_schema.role_table_grants WHERE grantee = 'studio_reader' AND table_name IN ('users','sessions','otp_codes','files','jobs','signin_attempts')`); check('5.3', ug[0].n === 0, 'studio_reader has no grant on users/sessions/otp_codes/files/jobs/signin_attempts');
  const idx = await sql(`SELECT indexname FROM pg_indexes WHERE indexname IN ('reports_report_date_uq','published_reports_report_date_uq','subscribers_whatsapp_uq','deliveries_report_date_subscriber_id_kind_uq')`); check('5.4', idx.length === 4, `the four declared UNIQUE indexes exist (${idx.length}/4)`);
  // the DB is the last line: a CHECK refuses what the app would refuse, inside a rolled-back transaction
  for (const [label, q] of [['Confidence_Pct 101', `UPDATE reports SET confidence_pct = 101 WHERE report_id = '${FX.sent}'`], ['Sentiment bogus', `UPDATE reports SET sentiment = 'MEGA' WHERE report_id = '${FX.sent}'`], ['Status bogus', `UPDATE reports SET status = 'Draft' WHERE report_id = '${FX.sent}'`]]) {
    let refused = false; try { await sql(`BEGIN; ${q}; ROLLBACK;`); } catch { refused = true; }
    (label === 'Status bogus' ? note : (id, m) => check(id, refused, m))('5.5', `database CHECK refuses ${label}: ${refused}`);
  }
}

try {
  console.log(`verify · app ${BASE}${DOOR ? ` · door ${DOOR}` : ''} · ${new Date().toISOString()}`);
  await setup();
  await subscriberScope();
  const analyst = await analystLimits();
  await serverActionValidation(analyst);
  await door();
  await database();
} finally { await cleanup(); }
const fails = results.filter((r) => r.kind === 'FAIL');
console.log(`\n${results.filter((r) => r.kind === 'PASS').length} PASS · ${fails.length} FAIL · ${results.filter((r) => r.kind === 'NOTE').length} NOTE`);
process.exit(fails.length ? 1 : 0);
