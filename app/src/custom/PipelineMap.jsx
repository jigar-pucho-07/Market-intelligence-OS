'use client';
// PipelineMap — the daily workflow as numbered steps, each carrying the state of the newest run (reports row), the error
// branch and the 06:20 watchdog, then the workflow configuration. The content comes from ./lib/pipeline.js (pipelineModel),
// shared with the PDF section PipelinePdf so the page and the printed run log always say the same thing.
import { useMemo } from 'react';
import { CalendarClock, Rss, Filter, Sparkles, FileText, Save, Send, ListChecks, BellRing, Timer } from 'lucide-react';
import { Callout } from '../components/ui/primitives';
import StatusBadge from '../components/StatusBadge';
import { cn } from '../utils/cn';
import { pipelineModel } from './lib/pipeline';

const DOT = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-ink-4' };
const TEXT = { ok: 'text-ok-text', warn: 'text-warn-text', bad: 'text-bad-text', neutral: 'text-ink-3' };
const ICONS = { schedule: CalendarClock, fetch: Rss, parse: Filter, ai: Sparkles, format: FileText, save: Save, broadcast: Send, log: ListChecks, error: BellRing, watchdog: Timer };

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
  const m = useMemo(() => pipelineModel(rows), [rows]);

  return (
    <div className="block-gap min-w-0" data-pipeline-map>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
        <h2 className="section-title">Latest run</h2>
        {m.header ? (
          <>
            <span className="text-[13px] text-ink tabular">{m.header.date}</span>
            <StatusBadge status={m.header.status} />
            {m.header.trigger && <span className="text-[12px] text-ink-3">Triggered by {m.header.trigger}</span>}
          </>
        ) : <span className="text-[13px] text-ink-3">No run recorded yet — the first one starts at 06:00 IST on a weekday.</span>}
      </div>
      {m.simulated && <Callout tone="warn" label="Simulated">This run was simulated — no source was fetched and nothing was sent.</Callout>}

      <ol className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4 list-none p-0 m-0" aria-label="Daily workflow, in order">
        {m.steps.map((s) => (
          <Node key={s.key} step={s.step} icon={ICONS[s.key]} title={s.title} sub={s.sub} tone={s.tone} state={s.state}>
            {s.sources && (
              <ul className="flex flex-col gap-1">
                {s.sources.map((x) => (
                  <li key={x.name} className="flex items-center justify-between gap-2 text-[12px] min-w-0" data-source={x.name}>
                    <span className="flex items-center gap-1.5 min-w-0 text-ink-2"><span aria-hidden className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT[x.tone])} /><span className="truncate">{x.name}</span></span>
                    {x.figure && <span className={cn('tabular text-right min-w-0 max-w-[60%] break-words', x.tone === 'warn' ? 'text-warn-text' : 'text-ink-3')} title={x.figure}>{x.figure}</span>}
                  </li>
                ))}
              </ul>
            )}
            {s.note && <p className="text-[12px] text-ink-2 break-words">{s.note}</p>}
          </Node>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2" aria-label="Safety nets">
        {m.branches.map((b) => { const I = ICONS[b.key]; return (
          <article key={b.key} className="rounded-[var(--r-10)] border border-dashed border-[color:var(--line-strong)] p-3.5 min-w-0 flex flex-col gap-2" data-pipeline-branch={b.key}>
            <div className="flex items-center gap-2.5"><I className="w-4 h-4 text-ink-3 shrink-0" strokeWidth={1.75} aria-hidden /><h3 className="text-[14px] font-semibold text-ink">{b.title}</h3></div>
            <p className="text-[12px] text-ink-3">{b.sub}</p>
            <Status tone={b.tone}>{b.state}</Status>
          </article>); })}
      </div>

      <section aria-labelledby="pm-cfg" className="min-w-0">
        <h2 id="pm-cfg" className="section-title mb-2.5">Workflow configuration</h2>
        <dl className="card grid sm:grid-cols-2 gap-x-8 gap-y-4 p-4" data-pipeline-config>
          {m.config.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5 min-w-0">
              <dt className="text-[12px] text-ink-3">{k}</dt>
              <dd className="text-[13px] font-medium text-ink tabular break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
