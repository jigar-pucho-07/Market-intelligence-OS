// app/src/custom/lib/market-flow.js — one function per Studio CODE step of the Market Intelligence flows. Each takes the step's
// mapped inputs and returns a flat object whose keys the later steps read (the same keys on every path, so no later step reads
// a key a branch did not return). The rules themselves live in ./market.js. tools/build_market_flows.py inlines what each step
// reaches; tests/market.test.mjs and tests/flow_sim.test.mjs run them. Plain JS, no app imports.
import {
  SOURCES, ENUMS, PUBLISHED_COLUMNS, selectArticles, buildPrompt, parseModel, buildReportRow, sanitizeReportRow, newsRows, istDate,
  istWeekday, rowsOf, statusOf, doorError, jobItems, isEmailEligible, normaliseEmail, adminEmails, reportEmail, alertEmail,
  toIso, istHHmm, scrubSecrets,
} from './market.js';

const nowOf = (inp) => (inp && inp.now ? new Date(inp.now) : new Date());
const listOf = (v) => (Array.isArray(v) ? v : []);
const ACTIONS = ['run', 'rerun'];

// ─────────────────────────────── MARKET_REPORT ───────────────────────────────

/** step_prep — the five feeds → the articles, the prompt, and the Failed row if nothing came back. Routes the flow. */
export function prepNews(inp) {
  const body = (inp && inp.body) || {}; const C = (inp && inp.C) || {}; const now = nowOf(inp);
  const action = String(body.action || '');
  const Mode = ACTIONS.includes(action) ? action : '';
  const Report_ID = Mode === 'rerun' ? String(body.Report_ID || '').trim() : '';
  const Trigger = Mode === 'run' && ENUMS.Trigger.includes(body.Trigger) ? body.Trigger : 'Manual';
  const feeds = Object.fromEntries(SOURCES.map((s) => [s.key, inp ? inp[s.key] : undefined]));
  const sel = selectArticles(feeds, { limit: Number(C.news_limit) || 40, summaryChars: Number(C.summary_chars) || 300,
    dedupeChars: Number(C.dedupe_chars) || 60, maxAgeHours: Number(C.max_age_hours) || 0, now });
  const meta = { Report_Date: istDate(now), Trigger, Articles_Analyzed: sel.articles.length, Source_Status: sel.Source_Status, Category_Breakdown: sel.Category_Breakdown };
  let route = sel.articles.length ? 'analyse' : 'failed'; let error = '';
  if (!Mode) { route = 'invalid'; error = `unknown action "${action.slice(0, 40)}" — MARKET_REPORT answers run and rerun`; }
  else if (Mode === 'rerun' && !Report_ID) { route = 'invalid'; error = 'rerun needs the Report_ID of a Failed report'; }
  const failed = buildReportRow({ status: 'Failed', error: `NO_NEWS: no usable article from the five sources — ${sel.Source_Status}`, meta, now });
  const articles = sel.articles.map((a) => ({ key: a.key, title: a.title, summary: a.summary, source: a.source, category: a.category, impact: a.impact, publishedAt: a.publishedAt, link: a.link }));
  return { route, error, action, Mode, Trigger, Report_ID, _job: String(body._job || ''), Report_Date: meta.Report_Date, Articles_Analyzed: meta.Articles_Analyzed,
    Source_Status: meta.Source_Status, Category_Breakdown: meta.Category_Breakdown, articles, prompt: route === 'analyse' ? buildPrompt({ articles: sel.articles, now }) : '', failed_report: failed };
}

/** step_*_finish — the model's answer → a Ready row (declared keys only, formatted) or a Failed row with the reason. */
export function finishReport(inp) {
  const ai = (inp && inp.ai) || {}; const prep = (inp && inp.prep) || {}; const now = nowOf(inp);
  const raw = ai && ai.data && typeof ai.data.response === 'string' ? ai.data.response : typeof ai.response === 'string' ? ai.response : '';
  const meta = { Report_Date: prep.Report_Date, Trigger: prep.Trigger, Articles_Analyzed: prep.Articles_Analyzed, Source_Status: prep.Source_Status, Category_Breakdown: prep.Category_Breakdown };
  const parsed = raw ? parseModel(raw) : { ok: false, fields: {}, error: `MODEL_ERROR: the AI step returned no answer${ai.error ? ` (${String(ai.error).slice(0, 80)})` : ''}`, removed: [] };
  const report = parsed.ok ? buildReportRow({ fields: parsed.fields, status: 'Ready', meta, now }) : buildReportRow({ status: 'Failed', error: parsed.error, meta, now });
  return { report, Status: report.Status, error: parsed.error, removed: parsed.removed.join(', ') };
}

// ─────────────────────────────── MARKET_REPORT (the gate) · MARKET_STORE ───────────────────────────────

/**
 * One report per Report_Date. run: no row today → new; today's row Failed → re-run it (PATCH); Ready or Sent → refused.
 * rerun: the Report_ID must exist, be Failed and be today's (the feeds only carry today's news). Sent is always refused.
 */
export function decideReport(Mode, reportId, rows, reportDate, today) {
  const no = (code, error) => ({ route: 'refuse', code, error, target: null });
  if (Mode === 'run') {
    const existing = rows.find((r) => r.Report_Date === reportDate);
    if (!existing) return { route: 'new', code: '', error: '', target: null };
    if (existing.Status === 'Failed') return { route: 'rerun', code: '', error: '', target: existing };
    return no('EXISTS', `Today's report already exists (${existing.Report_ID}, ${existing.Status}) — a Ready or Sent report is not overwritten`);
  }
  if (Mode !== 'rerun') return no('INVALID_INPUT', 'the action must be run or rerun');
  const target = rows.find((r) => r.Report_ID === String(reportId || ''));
  if (!target) return no('NOT_FOUND', `No report ${String(reportId || '').slice(0, 30)}`);
  if (target.Status === 'Sent') return no('SENT', `${target.Report_ID} was already sent — a sent report is never re-run`);
  if (target.Status !== 'Failed') return no('NOT_FAILED', `${target.Report_ID} is ${target.Status} — only a Failed report is re-run (edit a Ready one with Review)`);
  if (target.Report_Date !== today) return no('STALE_DATE', `${target.Report_ID} is for ${target.Report_Date}; the feeds carry today's news, so only today's report can be re-run`);
  return { route: 'rerun', code: '', error: '', target };
}

/** MARKET_REPORT step_gate — decide from the app's rows BEFORE any feed or model call is paid for (SA-02). */
export function reportGate(inp) {
  const body = (inp && inp.body) || {}; const now = nowOf(inp); const today = istDate(now);
  const Mode = ACTIONS.includes(body.action) ? body.action : '';
  const Trigger = Mode === 'run' && ENUMS.Trigger.includes(body.Trigger) ? body.Trigger : 'Manual';
  const rows = rowsOf(inp && inp.reports);
  const d = !rows ? { route: 'refuse', code: statusOf(inp.reports) === 403 ? 'APP_CLOSED' : 'APP_READ_FAILED', error: doorError(inp.reports, 'reports') }
    : decideReport(Mode, body.Report_ID, rows, today, today);
  const go = d.route !== 'refuse';
  return { route: go ? 'go' : 'refuse', code: d.code, error: d.error, Mode, Trigger, Report_ID: Mode === 'rerun' ? String(body.Report_ID || '') : '',
    _job: String(body._job || ''), jobs: go ? [] : jobItems(body._job, 'failed', { code: d.code, error: d.error }) };
}

/** MARKET_STORE step_plan — the same decision again at write time (race-safe), on a row that is re-checked field by field. */
export function storePlan(inp) {
  const body = (inp && inp.body) || {}; const now = nowOf(inp); const today = istDate(now);
  const rows = rowsOf(inp && inp.reports); const Mode = body.Mode === 'rerun' ? 'rerun' : body.Mode === 'run' ? 'run' : '';
  const row = sanitizeReportRow(body.report);
  const out = (route, code, error, target) => ({ route, code, error, Report_ID: target ? target.Report_ID : '', Report_Date: target ? target.Report_Date : row.Report_Date,
    row, news: route === 'rerun' ? newsRows(body.articles, target.Report_ID, now.toISOString()) : [], articles: listOf(body.articles),
    jobs: route === 'refuse' ? jobItems(body._job, 'failed', { code, error }) : [] });
  if (!Mode) return out('refuse', 'INVALID_INPUT', 'store needs Mode run or rerun', null);
  if (!rows) return out('refuse', statusOf(inp.reports) === 403 ? 'APP_CLOSED' : 'APP_READ_FAILED', doorError(inp.reports, 'reports'), null);
  const d = decideReport(Mode, body.Report_ID, rows, row.Report_Date, today);
  return out(d.route, d.code, d.error, d.target);
}

/** step_*_after — read the write's answer: the app-numbered Report_ID, the news rows with their ids, the hand-offs. */
export function afterWrite(inp) {
  const plan = (inp && inp.plan) || {}; const C = (inp && inp.C) || {}; const body = (inp && inp.body) || {}; const now = nowOf(inp);
  const written = rowsOf(inp && inp.written); const st = statusOf(inp && inp.written);
  const id = written && written[0] && written[0].Report_ID ? written[0].Report_ID : '';
  const Status = written && written[0] ? written[0].Status || plan.row.Status : plan.row && plan.row.Status;
  const error = id ? '' : st === 409 ? "EXISTS: today's report was written by another run meanwhile — this run's result was not stored"
    : st === 403 ? doorError(inp.written, 'reports') : `WRITE_FAILED: the app refused the report (${st || 'no response'})`;
  const ok = !!id;
  const autoSend = C.auto_send === true || String(C.auto_send) === 'true';
  const broadcasts = !ok ? [] : Status === 'Failed' ? [{ action: 'alert', Report_ID: id }] : autoSend ? [{ action: 'send', Report_ID: id }] : [];
  const result = { Report_ID: id, Status: ok ? Status : '', Articles_Analyzed: ok ? Number(plan.row.Articles_Analyzed) || 0 : 0, ...(ok ? {} : { error }) };
  return { ok, Report_ID: id, Status: ok ? Status : '', error, news: ok ? newsRows(plan.articles, id, now.toISOString()) : [], broadcasts,
    jobs: jobItems(body._job, ok ? 'done' : 'failed', result) };
}

// ─────────────────────────────── BROADCAST ───────────────────────────────

/** The only alert text the watchdog can cause — fixed here, never taken from the caller (SA-03). */
export function watchdogText(today) { return `No report row by 06:20 IST for ${today} (or the app could not be read) — the 06:00 run did not finish`; }

/**
 * step_send_plan — who gets what, decided from the report row only (SA-24); a caller's `Kind` is never read.
 *   action send (the app):  the row Failed → mi_run_failed to the admins · Ready or Sent of TODAY → mi_daily_report to every Active,
 *                           opted-in subscriber (a Sent one re-sends idempotently: whoever has it answers 409 → skip) · another day → refused.
 *   action alert (flows only — MARKET_STORE for a Failed report, the 06:20 watchdog with no report; no app role holds it):
 *                           the admins, with the report's Error_Message or the fixed watchdog text. Never caller text (SA-03).
 * Each item becomes a Queued delivery first; one admin row per attempt (ADMIN-n-HHmm), so a second alert the same day goes out.
 */
export function sendPlan(inp) {
  const body = (inp && inp.body) || {}; const C = (inp && inp.C) || {}; const now = nowOf(inp); const today = istDate(now);
  const reports = rowsOf(inp && inp.reports); const subs = rowsOf(inp && inp.subscribers);
  const report = reports && body.Report_ID ? reports.find((r) => r.Report_ID === String(body.Report_ID)) || null : null;
  const publish = { Report_ID: report ? report.Report_ID : '', _job: String(body._job || '') };
  const done = (kind, items, reason, code = '') => ({ kind, items, reason, code, Report_ID: publish.Report_ID, publish, queued: items.length });
  const alertWatchdog = body.action === 'alert' && !body.Report_ID;
  if (alertWatchdog || (report && report.Status === 'Failed')) {
    const date = report ? report.Report_Date : today;
    const error = report ? report.Error_Message || 'The report could not be generated' : watchdogText(today);
    const emails = adminEmails(C.alert_to); const at = istHHmm(now); const mail = alertEmail({ error, reportDate: date, now });
    const items = emails.map((to, i) => ({ to, subject: mail.subject, body: mail.body,
      delivery: { Kind: 'Alert', Report_ID: report ? report.Report_ID : '', Report_Date: date, Subscriber_ID: `ADMIN-${i + 1}-${at}`, Subscriber_Name: `Admin alert ${i + 1}`, Sentiment: '', Status: 'Queued' } }));
    return done('Alert', items, emails.length ? '' : 'constants.alert_to has no email address yet — nobody was alerted');
  }
  if (!reports) return done('Report', [], doorError(inp.reports, 'reports'), 'APP_READ_FAILED');
  if (!report) return done('Report', [], `No report ${String(body.Report_ID || '').slice(0, 30)}`, 'NOT_FOUND');
  if (body.action === 'alert') return done('Alert', [], `${report.Report_ID} is ${report.Status} — no alert`, 'NOT_FAILED');
  if (!['Ready', 'Sent'].includes(report.Status)) return done('Report', [], `${report.Report_ID} is ${report.Status} — not sent`, 'NOT_READY');
  if (report.Report_Date !== today) return done('Report', [], `${report.Report_ID} is the report for ${report.Report_Date} — only today's report is sent`, 'NOT_TODAY');
  if (!subs) return done('Report', [], doorError(inp.subscribers, 'subscribers'), 'APP_READ_FAILED');
  const mail = reportEmail(report);
  const items = subs.filter(isEmailEligible).map((s) => ({ to: normaliseEmail(s.Email), subject: mail.subject, body: mail.body,
    delivery: { Kind: 'Report', Report_ID: report.Report_ID, Report_Date: report.Report_Date, Subscriber_ID: s.Subscriber_ID, Subscriber_Name: s.Name || '', Sentiment: report.Sentiment || '', Status: 'Queued' } }));
  return done('Report', items, items.length ? '' : 'No Active, opted-in subscriber with an email address');
}

/** step_*_result — what Gmail answered (its message id) → the delivery's Status, Message_ID, Error_Message. Unconfirmed is Failed (retryable). */
export function sendResult(inp) {
  const id = String((inp && inp.Delivery_ID) || ''); const out = inp && inp.sent; const now = nowOf(inp).toISOString();
  const o = out && typeof out === 'object' ? out : {};
  const pick = (...vals) => vals.find((v) => typeof v === 'string' && v.trim()) || '';
  const msgId = pick(o.messageId, o.message_id, o.id, o.wamid, o.messages && o.messages[0] && o.messages[0].id, o.data && o.data.messages && o.data.messages[0] && o.data.messages[0].id,
    o.body && o.body.messages && o.body.messages[0] && o.body.messages[0].id, o.data && o.data.id);
  const err = pick(o.error && (o.error.message || o.error), o.errorMessage, o.success === false ? o.message : '', o.status === 'failed' ? o.message : '');
  const failed = !!err || !out || (typeof out === 'object' && !Object.keys(o).length);
  return { Delivery_ID: id, Status: failed ? 'Failed' : 'Sent', Message_ID: failed ? '' : msgId.slice(0, 120),
    Error_Message: failed ? scrubSecrets(err || 'Email step returned nothing').slice(0, 300) : '', Sent_At: now, sent: !failed };
}

export const MAX_ATTEMPTS = 3;
/**
 * step_retry_plan — one Failed Report delivery, again, to the number on the subscriber record (never one from the payload), at most
 * MAX_ATTEMPTS times. The claim is a PATCH of Attempts = read + 1, conditional on Attempts = the value read; only a claimed row
 * (the PATCH answered with it) is sent. A refusal leaves the claim's Delivery_ID blank, so the app refuses the PATCH and nothing goes out.
 */
export function retryPlan(inp) {
  const body = (inp && inp.body) || {}; const C = (inp && inp.C) || {}; const now = nowOf(inp);
  const dels = rowsOf(inp && inp.deliveries); const subs = rowsOf(inp && inp.subscribers); const reports = rowsOf(inp && inp.reports);
  const none = (reason, d) => ({ claim: { Delivery_ID: '', Attempts: 0, expect: '' }, send: { to: '', subject: '', body: '' }, reason,
    Delivery_ID: d ? d.Delivery_ID : '', publish: { Report_ID: d ? d.Report_ID : '', _job: '' } });
  if (!dels || !subs || !reports) return none(doorError(!dels ? inp.deliveries : !subs ? inp.subscribers : inp.reports, !dels ? 'deliveries' : !subs ? 'subscribers' : 'reports'));
  const d = dels.find((x) => x.Delivery_ID === String(body.Delivery_ID || ''));
  if (!d) return none(`No delivery ${String(body.Delivery_ID || '').slice(0, 30)}`);
  if (d.Kind !== 'Report' || d.Status !== 'Failed') return none(`${d.Delivery_ID} is a ${d.Kind} delivery that is ${d.Status} — only a Failed report delivery is retried`, d);
  const n = Math.max(0, Math.round(Number(d.Attempts) || 0));
  if (n >= MAX_ATTEMPTS) return none(`${d.Delivery_ID} has had ${n} attempts — the cap is ${MAX_ATTEMPTS} attempts`, d);
  const s = subs.find((x) => x.Subscriber_ID === d.Subscriber_ID);
  if (!isEmailEligible(s)) return none(`${d.Subscriber_Name || d.Subscriber_ID} is not Active and opted in with an email address — not sent`, d);
  const r = reports.find((x) => x.Report_ID === d.Report_ID);
  if (!r || !['Ready', 'Sent'].includes(r.Status)) return none(`Report ${d.Report_ID} is not Ready or Sent — not sent`, d);
  const mail = reportEmail(r);
  return { claim: { Delivery_ID: d.Delivery_ID, Attempts: n + 1, expect: `eq.${n}` }, send: { to: normaliseEmail(s.Email), subject: mail.subject, body: mail.body },
    reason: '', Delivery_ID: d.Delivery_ID, publish: { Report_ID: r.Report_ID, _job: '' } };
}

// ─────────────────────────────── MARKET_PUBLISH ───────────────────────────────

/**
 * step_plan — after a send or a retry, from the app's own rows: the report's Sent / Failed counts and Status Sent, the reader-safe
 * copy (published_reports) and the app's job. Only a Ready / Sent report with at least one delivery that was actually Sent is marked
 * Sent and published; nothing sent leaves it Ready and fails the job (NOTHING_SENT). A Failed report (an alert run) writes nothing.
 */
export function publishPlan(inp) {
  const body = (inp && inp.body) || {}; const now = nowOf(inp);
  const reports = rowsOf(inp && inp.reports); const dels = rowsOf(inp && inp.deliveries);
  const report = reports ? reports.find((r) => r.Report_ID === String(body.Report_ID || '')) || null : null;
  const mine = report && dels ? dels.filter((d) => d.Kind === 'Report' && (d.Report_ID === report.Report_ID || (!d.Report_ID && d.Report_Date === report.Report_Date))) : [];
  const sent = mine.filter((d) => d.Status === 'Sent'); const failedN = mine.filter((d) => d.Status === 'Failed').length;
  const ok = !!report && ['Ready', 'Sent'].includes(report.Status) && sent.length > 0;
  const firstSent = sent.map((d) => toIso(d.Sent_At)).filter(Boolean).sort()[0];
  const sentAt = toIso(report && report.Sent_At) || firstSent || now.toISOString();
  const alertRun = !!report && report.Status === 'Failed';
  const reason = !reports || !dels ? doorError(!reports ? inp.reports : inp.deliveries, !reports ? 'reports' : 'deliveries')
    : !report ? `No report ${String(body.Report_ID || '').slice(0, 30)}` : alertRun ? `${report.Report_ID} is Failed — the admins were alerted, nothing published`
    : !ok ? `NOTHING_SENT: ${report.Report_ID} has ${mine.length} report deliveries and none was sent — left ${report.Status}` : '';
  const published = ok ? { Report_ID: report.Report_ID, Published_At: sentAt, ...Object.fromEntries(PUBLISHED_COLUMNS.map((c) => [c, report[c] ?? ''])) } : {};
  const pub = ok ? [{ Report_ID: report.Report_ID, patch: { Status: 'Sent', Sent_At: sentAt, Sent_Count: sent.length, Failed_Count: failedN }, published }] : [];
  const result = { sent: sent.length, failed: failedN, skipped: 0, published: ok, ...(reason ? { note: reason } : {}) };
  return { ok, reason, Report_ID: report ? report.Report_ID : '', pub, jobs: jobItems(body._job, ok || alertRun ? 'done' : 'failed', result), Sent_Count: sent.length, Failed_Count: failedN };
}

// ─────────────────────────────── DAILY_SCHEDULE · DAILY_WATCHDOG ───────────────────────────────

const holidaysOf = (C) => listOf(C && C.holidays).map((d) => String(d).slice(0, 10));
/** step_gate — weekdays only (the trigger says so too) and never on a date in constants.holidays (NSE holidays, ⚑ G3). */
export function scheduleGate(inp) {
  const C = (inp && inp.C) || {}; const now = nowOf(inp); const today = istDate(now); const day = istWeekday(now);
  if (day === 'Sat' || day === 'Sun') return { route: 'skip', today, reason: `${day} — the market is closed` };
  if (holidaysOf(C).includes(today)) return { route: 'skip', today, reason: `${today} is in constants.holidays (NSE holiday)` };
  return { route: 'run', today, reason: '' };
}
/** step_check — 06:20 IST: today's report row must exist; if not (or the app cannot be read), alert the admins through BROADCAST. */
export function watchdogCheck(inp) {
  const C = (inp && inp.C) || {}; const gate = scheduleGate(inp); const rows = rowsOf(inp && inp.reports);
  if (gate.route === 'skip') return { route: 'ok', today: gate.today, reason: gate.reason, Error_Message: '' };
  if (!rows) return { route: 'alert', today: gate.today, reason: 'app unreadable', Error_Message: '' };
  const row = rows.find((r) => r.Report_Date === gate.today);
  if (row) return { route: 'ok', today: gate.today, reason: `${row.Report_ID} is ${row.Status}`, Error_Message: '' };
  return { route: 'alert', today: gate.today, reason: 'no row', Error_Message: '' };
}
