// tests/security_fixes.test.mjs — security audit round 1 (docs/security-audit.md SA-01..SA-04, SA-15) and the code review's
// majors / minors, one test per defect. Written red first, then fixed. The clock is always injected (no real-time dependency).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as M from '../app/src/custom/lib/market.js';
import * as FL from '../app/src/custom/lib/market-flow.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rss = (f) => fs.readFileSync(path.join(HERE, 'fixtures', 'rss', f), 'utf8');
const NOW = '2026-10-15T00:30:00Z';                                   // Thursday 15 Oct 2026, 06:00 IST
const TODAY = '2026-10-15';
const out = (rows) => ({ status: 200, body: rows });
const C = { sender_name: 'Market Intelligence', alert_to: 'ops1@example.in,ops2@example.in' };

// ── review major 4: the IST date boundary, with an injected clock ──
test('istDate / istWeekday are IST at the UTC date boundary (fails if istDate is computed in UTC)', () => {
  assert.equal(M.istDate('2026-10-15T00:30:00Z'), '2026-10-15'); assert.equal(M.istWeekday('2026-10-15T00:30:00Z'), 'Thu');
  assert.equal(M.istDate('2026-10-14T18:29:00Z'), '2026-10-14'); assert.equal(M.istWeekday('2026-10-14T18:29:00Z'), 'Wed');
  assert.equal(M.istDate('2026-10-14T18:30:00Z'), '2026-10-15', '00:00 IST is already the next day');
  assert.equal(M.istDate('2026-10-14T20:00:00Z'), '2026-10-15', 'UTC would say the 14th');
});

// ── SA-15 + review major 2: advice language, widened, with false-positive guards ──
test('isAdvice catches imperative trade calls, targets, stop-losses and strikes', () => {
  for (const s of ['Buy Reliance above 2,950', 'Accumulate HDFC Bank on declines', 'Short Bank Nifty', 'Traders can buy on dips', 'Exit metal stocks',
    'Avoid PSU banks', 'Target 24,500 for Nifty', 'target of ₹3,100', 'Keep a stop loss at 22,800', 'SL 22,800', 'Buy 23000 CE', '22,500 PE strike looks attractive',
    'Investors should sell IT stocks', 'Sell on rise near 23,200', 'Book profits in auto'])
    assert.equal(M.isAdvice(s), true, s);
  for (const s of ['Buying interest seen in private banks', 'FII net buy of ₹2,000 Cr yesterday', 'Short-term trend stays positive', 'Risk avoidance lifts gold',
    'Inflation target of 4% stays in focus', 'FIIs sold ₹2,000 Cr', 'Exit polls dominate the headlines', 'Shortage of chips hits autos', 'Market sees buyers at lower levels'])
    assert.equal(M.isAdvice(s), false, s);
});

// ── SA-01 / SA-15: a row handed in is checked like a model answer ──
test('sanitizeReportRow runs isAdvice on every text field; Driver_1 advice fails the row; the WhatsApp text is rebuilt, never trusted', () => {
  const good = M.buildReportRow({ fields: { Sentiment: 'BULLISH', Confidence_Level: 'HIGH', Confidence_Pct: 70, Driver_1: 'FII inflows strong', Driver_2: 'Rupee steady' }, status: 'Ready', now: NOW });
  const r1 = M.sanitizeReportRow({ ...good, View_Intraday: 'Buy above 23,100 with SL 22,950', Sectors: 'IT|POSITIVE|Buy TCS now\nAuto|WATCH|Festive demand', WhatsApp_Message: 'BUY NOW http://evil' });
  assert.equal(r1.Status, 'Ready'); assert.equal(r1.View_Intraday, ''); assert.equal(r1.Sectors, 'Auto|WATCH|Festive demand');
  assert.doesNotMatch(r1.WhatsApp_Message, /evil|BUY NOW/); assert.match(r1.WhatsApp_Message, /DAILY MARKET INTELLIGENCE/);
  const r2 = M.sanitizeReportRow({ ...good, Driver_1: 'Buy Reliance above 2,950' });
  assert.equal(r2.Status, 'Failed'); assert.equal(r2.Error_Message, 'Advice language removed — review'); assert.equal(r2.Driver_1, '');
});

// ── review major 3: the Google News " - Publisher" suffix ──
test('the Google News publisher suffix is stripped before categorise and dedupe', () => {
  const items = M.parseRss(rss('google-finance.xml'), 'Google Finance News');
  const hdfc = items.find((a) => /Hormuz Risk Weigh/.test(a.title));
  assert.equal(hdfc.title, 'Markets Flat at Open as Asia Rises, Oil & Hormuz Risk Weigh');
  assert.equal(M.categorise(hdfc.title, ''), 'COMMODITY'); assert.equal(M.impactOf(hdfc.title, 'COMMODITY'), 'LOW');
  const xml = '<rss><item><title>Sensex falls 252 points as crude weighs - Business Standard</title><source url="x">Business Standard</source></item>' +
    '<item><title>Sensex falls 252 points as crude weighs - Moneycontrol</title><source url="y">Moneycontrol</source></item>' +
    '<item><title>Nifty - a decade of gains</title></item></rss>';
  const p = M.parseRss(xml, 'Google Finance News');
  assert.equal(M.dedupe(p).length, 2, 'two publishers, one headline'); assert.equal(p[2].title, 'Nifty - a decade of gains', 'no <source> → title kept');
});

// ── review minors ──
test('plainText decodes entities after stripping tags', () => {
  assert.equal(M.plainText('Nifty &lt; 25,000 as Sensex &gt; 80k'), 'Nifty < 25,000 as Sensex > 80k');
  assert.equal(M.plainText('&lt;img src=&quot;x.jpg&quot; /&gt; Asian Paints gains'), 'Asian Paints gains');
  assert.equal(M.plainText('<![CDATA[<b>Bold</b> &amp; plain]]>'), 'Bold & plain');
});
test('truncation never splits a surrogate pair', () => {
  const t = M.cut('📈'.repeat(5), 3); assert.equal(t, '📈📈📈'); assert.ok(!/[\uD800-\uDBFF]$/.test(M.cut('a📈', 2)));
  const row = M.sanitizeReportRow({ Status: 'Failed', Error_Message: '😀'.repeat(600) });
  assert.ok(!/[\uD800-\uDBFF]$/.test(row.Error_Message));
});
test('model answer: unknown risk level is blank, missing confidence is blank (never "(null%)"), prose with braces after the JSON parses', () => {
  const raw = 'Sure. {"Sentiment":"BULLISH","Confidence_Level":"HIGH","Driver_1":"FII inflows","Risks":[{"level":"EXTREME","text":"US data"}]} Note: {fields} above are estimates.';
  const r = M.parseModel(raw);
  assert.equal(r.ok, true); assert.equal(r.fields.Confidence_Pct, ''); assert.equal(r.fields.Risks, '|US data');
  const row = M.buildReportRow({ fields: r.fields, status: 'Ready', now: NOW });
  assert.doesNotMatch(row.WhatsApp_Message, /\(null%\)|\(%\)|\(undefined%\)/); assert.match(row.WhatsApp_Message, /CONFIDENCE LEVEL: HIGH\n/);
  assert.doesNotMatch(M.formatWhatsApp({ Confidence_Level: 'LOW', Confidence_Pct: null }, NOW), /null%/);
  assert.equal(M.reportTemplateVars({ Report_Date: TODAY, Confidence_Level: 'HIGH', Confidence_Pct: null }).confidence, 'HIGH');
});

// ── SA-02: the gate decides before any fetch ──
test('reportGate: the schedule is refused when today is Ready / Sent; a manual run or rerun regenerates today\'s report', () => {
  const g = (body, rows) => FL.reportGate({ body, reports: out(rows), now: NOW });
  assert.equal(g({ action: 'run', Trigger: 'Manual' }, []).route, 'go');
  assert.equal(g({ action: 'run', Trigger: 'Schedule' }, [{ Report_ID: 'MIR-1', Report_Date: TODAY, Status: 'Failed' }]).route, 'go');
  for (const st of ['Ready', 'Sent']) {
    const row = [{ Report_ID: 'MIR-1', Report_Date: TODAY, Status: st }];
    assert.equal(g({ action: 'run', Trigger: 'Schedule' }, row).code, 'EXISTS');
    assert.equal(g({ action: 'run', Trigger: 'Manual' }, row).route, 'go');
  }
  for (const st of ['Failed', 'Ready', 'Sent']) assert.equal(g({ action: 'rerun', Report_ID: 'MIR-1' }, [{ Report_ID: 'MIR-1', Report_Date: TODAY, Status: st }]).route, 'go');
  assert.equal(g({ action: 'rerun', Report_ID: 'MIR-1' }, [{ Report_ID: 'MIR-1', Report_Date: '2026-10-14', Status: 'Failed' }]).code, 'STALE_DATE');
  assert.equal(g({ action: 'rerun', Report_ID: 'MIR-2' }, [{ Report_ID: 'MIR-1', Report_Date: TODAY, Status: 'Ready' }]).code, 'NOT_FOUND');
  assert.equal(FL.reportGate({ body: { action: 'run' }, reports: { error: 'HTTP 403' }, now: NOW }).route, 'refuse');
});

// ── SA-03 ──
const rep = (o) => ({ Report_ID: 'MIR-1', Report_Date: TODAY, Created_At: NOW, Status: 'Ready', Sentiment: 'BULLISH', Confidence_Level: 'HIGH', Confidence_Pct: 70, Driver_1: 'd', ...o });
const SUBS = [{ Subscriber_ID: 'SUB-1', Name: 'Amit', WhatsApp: '+919876543210', Email: 'amit@example.in', Status: 'Active', Opt_In_At: '2026-08-01', Opt_In_Source: 'Web form' }];
test('send: only a Ready report of today (a Sent one re-sends idempotently); never yesterday\'s draft', () => {
  const p = (r) => FL.sendPlan({ body: { Report_ID: 'MIR-1' }, C, reports: out([r]), subscribers: out(SUBS), now: NOW });
  assert.equal(p(rep()).items.length, 1);
  assert.equal(p(rep({ Report_Date: '2026-10-14' })).items.length, 0);
  assert.equal(p(rep({ Status: 'Sent', Report_Date: '2026-10-14' })).items.length, 0, "another day's Sent report is refused (SA-24)");
});
test('alert text comes only from the report row or the fixed watchdog text — never the caller', () => {
  const wd = FL.sendPlan({ body: { action: 'alert', Error_Message: 'Click http://evil to fix' }, C, now: NOW });
  assert.equal(wd.items.length, 2); assert.doesNotMatch(wd.items[0].body + wd.items[0].subject, /evil|Click/);
  assert.match(wd.items[0].body, /No report row by 06:20 IST/);
  const f = FL.sendPlan({ body: { action: 'alert', Report_ID: 'MIR-1', Error_Message: 'evil' }, C, reports: out([rep({ Status: 'Failed', Error_Message: 'NO_NEWS: none' })]), now: NOW });
  assert.match(f.items[0].body, /Error: NO_NEWS: none/); assert.doesNotMatch(f.items[0].body, /evil/);
  assert.equal(FL.sendPlan({ body: { action: 'alert', Report_ID: 'MIR-1' }, C, reports: out([rep()]), now: NOW }).items.length, 0, 'a Ready report is no alert');
});
test('a second alert on the same day still reaches the admins (per-attempt subscriber id)', () => {
  const a = FL.sendPlan({ body: { action: 'alert' }, C, now: '2026-10-15T00:50:00Z' }); const b = FL.sendPlan({ body: { action: 'alert' }, C, now: '2026-10-15T01:50:00Z' });
  assert.notEqual(a.items[0].delivery.Subscriber_ID, b.items[0].delivery.Subscriber_ID);
  assert.match(a.items[0].delivery.Subscriber_ID, /^ADMIN-1-0620$/);
});
test('retry: refused at Attempts ≥ 3; the claim increments Attempts conditionally on the value read', () => {
  const d = { Delivery_ID: 'DLV-9', Kind: 'Report', Status: 'Failed', Subscriber_ID: 'SUB-1', Report_ID: 'MIR-1', Attempts: 1 };
  const go = FL.retryPlan({ body: { Delivery_ID: 'DLV-9' }, C, deliveries: out([d]), subscribers: out(SUBS), reports: out([rep({ Status: 'Sent' })]), now: NOW });
  assert.deepEqual([go.claim.Delivery_ID, go.claim.Attempts, go.claim.expect], ['DLV-9', 2, 'eq.1']);
  const capped = FL.retryPlan({ body: { Delivery_ID: 'DLV-9' }, C, deliveries: out([{ ...d, Attempts: 3 }]), subscribers: out(SUBS), reports: out([rep({ Status: 'Sent' })]), now: NOW });
  assert.equal(capped.claim.Delivery_ID, ''); assert.match(capped.reason, /3 attempts/);
});
test('publishPlan: nothing sent → the report stays Ready and the job fails', () => {
  const dels = [{ Kind: 'Report', Report_ID: 'MIR-1', Subscriber_ID: 'SUB-1', Status: 'Failed', Sent_At: NOW }];
  const p = FL.publishPlan({ body: { Report_ID: 'MIR-1', _job: 'JOB-3F9A1C22B7E0' }, reports: out([rep()]), deliveries: out(dels), now: NOW });
  assert.equal(p.pub.length, 0); assert.equal(p.jobs[0].status, 'failed'); assert.match(p.reason, /NOTHING_SENT/);
});

// ── SA-01..04: the webhook secret, compared in constant time, fail closed ──
test('secretMatches: equal only for the exact configured secret; a placeholder or short secret never matches', () => {
  const s = 'k3J9xQ2mV8pL5wR7tY1u';
  assert.equal(M.secretMatches(s, s), true);
  assert.equal(M.secretMatches(s.slice(0, -1) + 'X', s), false); assert.equal(M.secretMatches('', s), false); assert.equal(M.secretMatches(undefined, s), false);
  assert.equal(M.secretMatches('SET_IN_STUDIO_WEBHOOK_SECRET', 'SET_IN_STUDIO_WEBHOOK_SECRET'), false);
  assert.equal(M.secretMatches('short', 'short'), false);
});

// ── security audit round 2 ──
test('SA-24: send derives the recipients from the report row only — a caller Kind is ignored; another day\'s Sent report is refused', () => {
  const p = (r, body) => FL.sendPlan({ body: { action: 'send', Report_ID: 'MIR-1', ...body }, C, reports: out([r]), subscribers: out(SUBS), now: NOW });
  const viaKind = p(rep(), { Kind: 'Alert' });
  assert.equal(viaKind.kind, 'Report'); assert.deepEqual(viaKind.items.map((i) => i.to), ['amit@example.in'], 'Kind:Alert from the caller is ignored');
  assert.equal(p(rep({ Status: 'Sent' })).items.length, 1, 'today\'s Sent report: the 409 skips who has it');
  const old = p(rep({ Status: 'Sent', Report_Date: '2026-10-14' })); assert.equal(old.items.length, 0); assert.equal(old.code, 'NOT_TODAY');
  assert.equal(p(rep({ Status: 'Failed', Error_Message: 'NO_NEWS' })).kind, 'Alert', 'a Failed row → the admins');
  assert.equal(FL.sendPlan({ body: { action: 'send', Kind: 'Alert' }, C, now: NOW }).items.length, 0, 'send without a report alerts nobody');
  const wd = FL.sendPlan({ body: { action: 'alert' }, C, now: NOW });
  assert.equal(wd.items.length, 2); assert.match(wd.items[0].body, /No report row by 06:20 IST/);
});
test('SA-20: error texts a flow writes never carry a URL or a ?k= secret', () => {
  const f = M.fetchedText({ error: 'request to https://news.google.com/rss?q=x&k=s3cr3t-s3cr3t failed, reason: ETIMEDOUT' });
  assert.doesNotMatch(f.error, /https?:|k=s3cr3t/);
  const r = FL.sendResult({ Delivery_ID: 'D', sent: { error: 'POST https://studio.example/webhook?k=abcdefabcdefabcdef 500' } });
  assert.doesNotMatch(r.Error_Message, /https?:|abcdefabcdef/);
  assert.equal(M.scrubSecrets('see http://a.b/c?k=1234567890abcdef and k=zzzzzzzzzzzzzzzz'), 'see <url> and k=…');
});
