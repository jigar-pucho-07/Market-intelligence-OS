// app/src/custom/lib/pipeline.js — the Pipeline page's content as data (24 Oct 2026), shared by the on-screen PipelineMap and the
// PDF section PipelinePdf so both always say the same thing: the newest run's header, its 8 steps with state and tone, the two
// safety nets, and the static workflow configuration. State is read from the reports row, never invented. Plain JS, no React.
import { newestRow, cleanRow, longDate, sourceRows, sourceSummary, sourceTone, sourceFigure, isTodayIST } from './view.js';

const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const n = (v) => (has(v) && Number.isFinite(Number(v)) ? Number(v) : null);

export const PIPELINE_CONFIG = [
  ['Trigger schedule', 'Every weekday 06:00 IST (Asia/Kolkata), weekends off'],
  ['Watchdog', '06:20 IST'],
  ['AI model', 'Studio llm-ai · standard'],
  ['Temperature', '0.3'],
  ['Max tokens', '2,000'],
  ['News limit', '40 articles / run'],
  ['Dedupe', 'first 60 title characters'],
  ['WhatsApp', 'pucho-whatsapp · approved template mi_daily_report'],
  ['Delivery days', 'Mon – Fri'],
  ['Error handling', 'Failed run → mi_run_failed alert to admins'],
];

export function pipelineModel(rows) {
  const r = cleanRow(newestRow(rows));
  const none = 'No run yet';
  const failed = r?.Status === 'Failed';
  const sent = r?.Status === 'Sent';
  const simulated = !!r && (/simulat/i.test(String(r.Model ?? '')) || /^simulated/i.test(String(r.Source_Status ?? '')));
  const sources = sourceRows(r?.Source_Status);
  const counted = !!r && sources.some((s) => s.count !== null);
  const summary = sourceSummary(sources);
  const today = isTodayIST(r?.Report_Date);
  const articles = n(r?.Articles_Analyzed);
  const sentCount = n(r?.Sent_Count) ?? 0;
  const failedCount = n(r?.Failed_Count) ?? 0;

  const steps = [
    { step: 1, key: 'schedule', title: 'Schedule', sub: '06:00 IST, Monday to Friday', tone: r ? 'ok' : 'neutral', state: r ? `Started${has(r.Trigger) ? ` · ${r.Trigger}` : ''}` : none },
    { step: 2, key: 'fetch', title: '5 parallel RSS fetches', sub: 'One step per source; a failed source never stops the run', tone: summary.tone,
      state: !r ? none : !counted && simulated ? 'Simulated — nothing fetched' : summary.text,
      sources: sources.map((s) => ({ name: s.name, tone: sourceTone(s, counted), figure: counted && s.count !== null ? sourceFigure(s) : '' })) },
    { step: 3, key: 'parse', title: 'Parse & categorise', sub: 'Code — dedupe, categorise, keep 40', tone: !r ? 'neutral' : articles === 0 ? 'bad' : 'ok',
      state: !r ? none : articles === null ? 'Done' : articles === 0 ? 'No articles kept' : `${articles} articles kept` },
    { step: 4, key: 'ai', title: 'AI analysis', sub: 'One call — commentary only', tone: !r ? 'neutral' : failed ? 'bad' : 'ok',
      state: !r ? none : failed ? 'Failed' : `Done${has(r.Model) ? ` · ${r.Model}` : ''}`, note: failed && has(r.Error_Message) ? r.Error_Message : '' },
    { step: 5, key: 'format', title: 'Format message', sub: 'Code — WhatsApp text, up to 4,000 characters', tone: !r ? 'neutral' : failed ? 'bad' : 'ok',
      state: !r ? none : failed ? 'Not produced' : n(r.Message_Length) !== null ? `${n(r.Message_Length).toLocaleString('en-IN')} characters` : 'Done' },
    { step: 6, key: 'save', title: 'Save report', sub: 'One report per date', tone: r ? 'ok' : 'neutral', state: r ? `Saved${has(r.Report_ID) ? ` · ${r.Report_ID}` : ''}` : none },
    { step: 7, key: 'broadcast', title: 'Broadcast', sub: 'WhatsApp template, one message per subscriber', tone: !r ? 'neutral' : sent ? (failedCount > 0 ? 'warn' : 'ok') : 'neutral',
      state: !r ? none : sent ? `${sentCount} sent · ${failedCount} failed` : failed ? 'Not sent to subscribers' : 'Waiting to be sent' },
    { step: 8, key: 'log', title: 'Delivery log', sub: 'One row per subscriber and report', tone: !r ? 'neutral' : sent ? 'ok' : 'neutral', state: !r ? none : sent ? 'Logged' : 'Nothing to log yet' },
  ];
  const branches = [
    { key: 'error', title: 'Error branch', sub: 'Failed run → admin WhatsApp alert (template mi_run_failed)', tone: !r ? 'neutral' : failed ? 'bad' : 'neutral',
      state: !r ? none : failed ? 'Triggered by the latest run' : 'Not needed — latest run did not fail' },
    { key: 'watchdog', title: '06:20 watchdog', sub: 'If no report exists by 06:20 IST, the admins are alerted.', tone: today ? 'ok' : 'warn', state: today ? 'Report for today exists' : 'No report for today yet' },
  ];
  return {
    row: r, simulated,
    header: r ? { date: longDate(r.Report_Date), status: r.Status, trigger: has(r.Trigger) ? String(r.Trigger).toLowerCase() : '' } : null,
    steps, branches, config: PIPELINE_CONFIG,
  };
}
