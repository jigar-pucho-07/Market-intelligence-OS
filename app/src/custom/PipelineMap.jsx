'use client';
// PipelineMap — the daily workflow as numbered steps, each carrying the state of the newest run (reports row), the error
// branch and the 06:20 watchdog, then the workflow configuration. Static text for the configuration; state is read, never invented.
import { useMemo } from 'react';
import { CalendarClock, Rss, Filter, Sparkles, FileText, Save, Send, ListChecks, BellRing, Timer } from 'lucide-react';
import { Callout } from '../components/ui/primitives';
import StatusBadge from '../components/StatusBadge';
import { cn } from '../utils/cn';
import { newestRow, longDate, sourceRows } from './lib/view';

const DOT = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-ink-4' };
const TEXT = { ok: 'text-ok-text', warn: 'text-warn-text', bad: 'text-bad-text', neutral: 'text-ink-3' };
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const n = (v) => (has(v) && Number.isFinite(Number(v)) ? Number(v) : null);

const CONFIG = [
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

function Status({ tone, children }) {
  return <p className={cn('flex items-center gap-1.5 text-[12px] font-medium', TEXT[tone])}><span aria-hidden className={cn('w-2 h-2 rounded-full shrink-0', DOT[tone])} />{children}</p>;
}

function Node({ step, icon: I, title, sub, tone, state, children, wide }) {
  return (
    <li className={cn('card p-3.5 min-w-0 flex flex-col gap-2', wide && 'sm:col-span-2')} data-pipeline-step={step} data-tone={tone}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="tabular w-6 h-6 rounded-full bg-surface-2 border border-[color:var(--line-soft)] text-[12px] font-semibold text-ink-2 flex items-center justify-center shrink-0">{step}</span>
        <I className="w-4 h-4 text-ink-3 shrink-0" strokeWidth={1.75} aria-hidden />
        <h3 className="text-[14px] font-semibold text-ink min-w-0">{title}</h3>
      </div>
      {sub && <p className="text-[12px] text-ink-3 break-words">{sub}</p>}
      {children}
      <Status tone={tone}>{state}</Status>
    </li>
  );
}

export default function PipelineMap({ rows }) {
  const r = useMemo(() => newestRow(rows), [rows]);
  const failed = r?.Status === 'Failed';
  const sent = r?.Status === 'Sent';
  const simulated = !!r && (/simulat/i.test(String(r.Model ?? '')) || /^simulated/i.test(String(r.Source_Status ?? '')));
  const sources = sourceRows(r?.Source_Status);
  const counted = !!r && sources.some((s) => s.count !== null);
  const bad = sources.filter((s) => s.count !== null && s.failed).length;
  const articles = n(r?.Articles_Analyzed);
  const none = 'No run yet';

  const fetchTone = !counted ? 'neutral' : bad === 0 ? 'ok' : bad === 5 ? 'bad' : 'warn';
  const fetchState = !r ? none : !counted ? (simulated ? 'Simulated — nothing fetched' : 'Counts not recorded') : bad === 0 ? 'All 5 sources answered' : `${bad} of 5 returned nothing`;
  const aiState = !r ? none : failed ? 'Failed' : `Done${has(r.Model) ? ` · ${r.Model}` : ''}`;
  const sentCount = n(r?.Sent_Count) ?? 0;
  const failedCount = n(r?.Failed_Count) ?? 0;

  return (
    <div className="block-gap min-w-0" data-pipeline-map>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
        <h2 className="section-title">Latest run</h2>
        {r ? (
          <>
            <span className="text-[13px] text-ink tabular">{longDate(r.Report_Date)}</span>
            <StatusBadge status={r.Status} />
            {has(r.Trigger) && <span className="text-[12px] text-ink-3">Triggered by {String(r.Trigger).toLowerCase()}</span>}
          </>
        ) : <span className="text-[13px] text-ink-3">No run recorded yet — the first one starts at 06:00 IST on a weekday.</span>}
      </div>
      {simulated && <Callout tone="warn" label="Simulated">This run was simulated — no source was fetched and nothing was sent.</Callout>}

      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 list-none p-0 m-0" aria-label="Daily workflow, in order">
        <Node step={1} icon={CalendarClock} title="Schedule" sub="06:00 IST, Monday to Friday" tone={r ? 'ok' : 'neutral'} state={r ? `Started${has(r.Trigger) ? ` · ${r.Trigger}` : ''}` : none} />
        <Node step={2} icon={Rss} title="5 parallel RSS fetches" sub="One step per source; a failed source never stops the run" tone={fetchTone} state={fetchState}>
          <ul className="flex flex-col gap-1">
            {sources.map((s) => {
              const t = !counted || s.count === null ? 'neutral' : s.failed ? 'warn' : 'ok';
              return (
                <li key={s.name} className="flex items-center justify-between gap-2 text-[12px] min-w-0" data-source={s.name}>
                  <span className="flex items-center gap-1.5 min-w-0 text-ink-2"><span aria-hidden className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT[t])} /><span className="truncate">{s.name}</span></span>
                  {counted && s.count !== null && <span className={cn('tabular shrink-0', s.failed ? 'text-warn-text' : 'text-ink-3')}>{s.failed ? '0 · failed' : s.count}</span>}
                </li>
              );
            })}
          </ul>
        </Node>
        <Node step={3} icon={Filter} title="Parse & categorise" sub="Code — dedupe, categorise, keep 40" tone={!r ? 'neutral' : articles === 0 ? 'bad' : 'ok'} state={!r ? none : articles === null ? 'Done' : articles === 0 ? 'No articles kept' : `${articles} articles kept`} />
        <Node step={4} icon={Sparkles} title="AI analysis" sub="One call — commentary only" tone={!r ? 'neutral' : failed ? 'bad' : 'ok'} state={aiState}>
          {failed && has(r.Error_Message) && <p className="text-[12px] text-ink-2 break-words">{r.Error_Message}</p>}
        </Node>
        <Node step={5} icon={FileText} title="Format message" sub="Code — WhatsApp text, up to 4,000 characters" tone={!r ? 'neutral' : failed ? 'bad' : 'ok'} state={!r ? none : failed ? 'Not produced' : n(r.Message_Length) !== null ? `${n(r.Message_Length).toLocaleString("en-IN")} characters` : 'Done'} />
        <Node step={6} icon={Save} title="Save report" sub="One report per date" tone={r ? 'ok' : 'neutral'} state={r ? `Saved${has(r.Report_ID) ? ` · ${r.Report_ID}` : ''}` : none} />
        <Node step={7} icon={Send} title="Broadcast" sub="WhatsApp template, one message per subscriber" tone={!r ? 'neutral' : sent ? (failedCount > 0 ? 'warn' : 'ok') : 'neutral'} state={!r ? none : sent ? `${sentCount} sent · ${failedCount} failed` : failed ? 'Not sent to subscribers' : 'Waiting to be sent'} />
        <Node step={8} icon={ListChecks} title="Delivery log" sub="One row per subscriber and report" tone={!r ? 'neutral' : sent ? 'ok' : 'neutral'} state={!r ? none : sent ? 'Logged' : 'Nothing to log yet'} />
      </ol>

      <div className="grid gap-3 sm:grid-cols-2" aria-label="Safety nets">
        <article className="rounded-[var(--r-10)] border border-dashed border-[color:var(--line-strong)] p-3.5 min-w-0 flex flex-col gap-2" data-pipeline-branch="error">
          <div className="flex items-center gap-2.5"><BellRing className="w-4 h-4 text-ink-3 shrink-0" strokeWidth={1.75} aria-hidden /><h3 className="text-[14px] font-semibold text-ink">Error branch</h3></div>
          <p className="text-[12px] text-ink-3">Failed run → admin WhatsApp alert (template mi_run_failed)</p>
          <Status tone={!r ? 'neutral' : failed ? 'bad' : 'neutral'}>{!r ? none : failed ? 'Triggered by the latest run' : 'Not needed — latest run did not fail'}</Status>
        </article>
        <article className="rounded-[var(--r-10)] border border-dashed border-[color:var(--line-strong)] p-3.5 min-w-0 flex flex-col gap-2" data-pipeline-branch="watchdog">
          <div className="flex items-center gap-2.5"><Timer className="w-4 h-4 text-ink-3 shrink-0" strokeWidth={1.75} aria-hidden /><h3 className="text-[14px] font-semibold text-ink">06:20 watchdog</h3></div>
          <p className="text-[12px] text-ink-3">If no report exists by 06:20 IST, the admins are alerted.</p>
          <Status tone={r ? 'ok' : 'warn'}>{r ? 'A report row exists' : 'No report row found'}</Status>
        </article>
      </div>

      <section aria-labelledby="pm-cfg" className="min-w-0">
        <h2 id="pm-cfg" className="section-title mb-2.5">Workflow configuration</h2>
        <dl className="card grid sm:grid-cols-2 divide-y divide-[color:var(--line-soft)] sm:divide-y-0" data-pipeline-config>
          {CONFIG.map(([k, v]) => (
            <div key={k} className="px-4 py-3 flex flex-col gap-0.5 min-w-0 sm:border-b sm:border-[color:var(--line-soft)]">
              <dt className="text-[12px] text-ink-3">{k}</dt>
              <dd className="text-[13px] font-medium text-ink tabular break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
