'use client';
// MarketBrief — the daily market report on one screen: sentiment, six segments, sectors, risks, views by trader type,
// the WhatsApp preview, the news sources and the disclaimer. Reads the page's entity (reports on the desk, published_reports
// for subscribers) and shows the newest row by Report_Date. Columns the entity lacks simply hide their bits.
import { useMemo } from 'react';
import { MessageCircle, FileWarning, FileText } from 'lucide-react';
import { Callout, Progress, Tiles } from '../components/ui/primitives';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { cn } from '../utils/cn';
import { formatWhatsApp, parseSectors, parseRisks, DISCLAIMER } from './lib/market';
import { outlookTone, levelTone, BADGE_CLASS, newestRow, cleanRow, istStamp, longDate, sourceRows, sourceSummary, sourceTone, sourceFigure, whatsappText } from './lib/view';

const DOT = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-ink-4' };
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';

function Tone({ word, tone }) {
  if (!has(word)) return null;
  return <span className={cn('badge', BADGE_CLASS[tone ?? outlookTone(word)])}>{word}</span>;
}
function Section({ id, title, aside, children }) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <h2 id={id} className="section-title">{title}</h2>
        {aside && <span className="text-[12px] text-ink-3 tabular">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
function Segment({ title, children, outlook }) {
  return (
    <article className="card p-4 min-w-0 flex flex-col gap-2.5" data-segment={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        <Tone word={outlook} />
      </div>
      {children}
    </article>
  );
}
function Field({ label, children }) {
  if (!has(children)) return null;
  return <p className="text-[13px] min-w-0"><span className="block text-[12px] text-ink-3">{label}</span><span className="font-semibold text-ink tabular break-words">{children}</span></p>;
}
const Reason = ({ children }) => (has(children) ? <p className="text-[13px] leading-[1.5] text-ink-2 break-words">{children}</p> : null);

export default function MarketBrief({ rows }) {
  const r = useMemo(() => cleanRow(newestRow(rows)), [rows]);
  if (!r) return <EmptyState icon={FileText} title="No report yet" description="The report is created at 06:00 IST every trading morning. Today's brief appears here as soon as it is ready." />;

  const desk = r.Status !== undefined;
  const simulated = /simulat/i.test(String(r.Model ?? '')) || /^simulated/i.test(String(r.Source_Status ?? ''));
  const stamp = istStamp(r.Created_At ?? r.Published_At);
  const sectors = parseSectors(r.Sectors);
  const risks = parseRisks(r.Risks);
  const views = [['Positional traders', r.View_Positional], ['Intraday traders', r.View_Intraday], ['Long-term investors', r.View_LongTerm], ['F&O traders', r.View_FnO]].filter(([, v]) => has(v));
  const sources = sourceRows(r.Source_Status);
  const whatsapp = whatsappText(r, (row) => formatWhatsApp(row, row.Created_At ?? row.Published_At));
  const summary = sourceSummary(sources);
  const counted = desk && sources.some((s) => s.count !== null);
  const drivers = [r.Driver_1, r.Driver_2, r.Driver_3].filter(has);
  const tone = outlookTone(r.Sentiment);
  const meta = [
    { key: 'news', label: 'News analysed', value: has(r.Articles_Analyzed) ? r.Articles_Analyzed : '—' },
    { key: 'model', label: 'AI model class', value: has(r.Model) ? r.Model : '—' },
    { key: 'time', label: 'Report time', value: stamp || '—' },
    { key: 'src', label: 'News sources', value: 5 },
  ];

  return (
    <div className="block-gap min-w-0" data-market-brief>
      {simulated && <Callout tone="warn" label="Simulated">SIMULATED run — this is sample content, not a market report. Nothing here came from live news.</Callout>}
      {desk && r.Status === 'Failed' && <Callout tone="bad" icon={FileWarning} label="Run failed">{has(r.Error_Message) ? r.Error_Message : 'The run failed. No error text was recorded.'}</Callout>}

      {/* (a) hero */}
      <section aria-label="Market sentiment" className="card p-5 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="section-title">Overall market sentiment · {longDate(r.Report_Date)}</p>
          {desk && <StatusBadge status={r.Status} />}
        </div>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start">
          <div className="min-w-0">
            <p className="flex items-center gap-3 text-[28px] sm:text-[32px] leading-[1.1] font-semibold text-ink break-words" data-sentiment>
              <span aria-hidden className={cn('w-3 h-3 rounded-full shrink-0', DOT[tone])} />{has(r.Sentiment) ? r.Sentiment : '—'}
            </p>
            <div className="mt-3 max-w-[320px]">
              <p className="text-[13px] text-ink-2 mb-1.5">Confidence <span className="font-semibold text-ink">{has(r.Confidence_Level) ? r.Confidence_Level : '—'}</span>{has(r.Confidence_Pct) && <span className="tabular"> · {r.Confidence_Pct}%</span>}</p>
              {has(r.Confidence_Pct) && <Progress pct={Number(r.Confidence_Pct)} />}
            </div>
          </div>
          {drivers.length > 0 && (
            <div className="min-w-0">
              <h3 className="text-[12px] text-ink-3 mb-1.5">Key market drivers</h3>
              <ol className="flex flex-col gap-2">
                {drivers.map((d, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-[1.45] text-ink"><span className="tabular text-[12px] text-ink-3 w-4 shrink-0 pt-[3px]">{i + 1}</span><span className="break-words min-w-0">{d}</span></li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <Tiles className="mt-5" items={meta} />
      </section>

      {/* (b) segments */}
      <Section id="mb-seg" title="Segment-wise analysis">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Segment title="Sensex" outlook={r.Sensex_Outlook}><Field label="Range in focus">{r.Sensex_Range}</Field><Reason>{r.Sensex_Reason}</Reason></Segment>
          <Segment title="Nifty 50" outlook={r.Nifty_Outlook}><Field label="Range in focus">{r.Nifty_Range}</Field><Reason>{r.Nifty_Reason}</Reason></Segment>
          <Segment title="Bank Nifty" outlook={r.BankNifty_Outlook}><Field label="Range in focus">{r.BankNifty_Range}</Field><Reason>{r.BankNifty_Reason}</Reason></Segment>
          <Segment title="Nifty F&O" outlook={r.FnO_View}><Field label="VIX expectation">{r.VIX_Expectation}</Field><Reason>{r.FnO_Reason}</Reason></Segment>
          <Segment title="Mid & Small Cap" outlook={r.MidSmall_Outlook}><Field label="Sectors in focus">{r.MidSmall_Focus}</Field><Reason>{r.MidSmall_Reason}</Reason></Segment>
          <Segment title="Commodities" outlook={r.Commodity_Outlook}><Reason>{r.Commodity_Reason}</Reason></Segment>
        </div>
      </Section>

      {/* (c) sectors and (d) risks */}
      {(sectors.length > 0 || risks.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          {sectors.length > 0 && (
            <Section id="mb-sec" title="Sector watch">
              <ul className="card divide-y divide-[color:var(--line-soft)]">
                {sectors.map((s, i) => (
                  <li key={i} className="p-3.5 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2"><span className="text-[14px] font-semibold text-ink min-w-0 break-words">{s.sector}</span><Tone word={s.call} /></div>
                    <Reason>{s.reason}</Reason>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {risks.length > 0 && (
            <Section id="mb-risk" title="Key risks today">
              <ul className="card divide-y divide-[color:var(--line-soft)]">
                {risks.map((k, i) => (
                  <li key={i} className="p-3.5 flex items-start gap-3">
                    <span className="shrink-0 w-16 pt-px"><Tone word={k.level || '—'} tone={levelTone(k.level)} /></span>
                    <p className="text-[13px] leading-[1.5] text-ink-2 min-w-0 break-words">{k.text}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      {/* (e) views by trader type */}
      {views.length > 0 && (
        <Section id="mb-view" title="Market view by trader type">
          <div className="grid gap-3 sm:grid-cols-2">
            {views.map(([who, text]) => (
              <article key={who} className="card p-4 min-w-0"><h3 className="text-[13px] font-semibold text-ink mb-1">{who}</h3><p className="text-[13px] leading-[1.5] text-ink-2 break-words">{text}</p></article>
            ))}
          </div>
        </Section>
      )}

      {/* (f) WhatsApp preview and (g) sources */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
        <Section id="mb-wa" title="WhatsApp delivery preview" aside={whatsapp ? `${whatsapp.length.toLocaleString('en-IN')} / 4,000 characters` : undefined}>
          <div className="rounded-[var(--r-10)] bg-surface-2 border border-[color:var(--line-soft)] p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-[12px] text-ink-3 mb-2"><MessageCircle className="w-3.5 h-3.5" aria-hidden />{r.WhatsApp_Message ? 'The message that was stored for this report' : 'Preview — this report has no stored message yet'}</div>
            {whatsapp ? <div tabIndex={0} role="region" aria-label="WhatsApp message text" className="max-h-[360px] overflow-y-auto rounded-[var(--r-8)] rounded-tl-[var(--r-4)] bg-surface border border-[color:var(--line)] px-3.5 py-3 text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words" data-whatsapp-preview>{whatsapp}</div>
              : <Callout tone="bad" icon={FileWarning} label="No message produced">{has(r.Error_Message) ? r.Error_Message : 'This run failed before a WhatsApp message was written.'}</Callout>}
          </div>
        </Section>
        <Section id="mb-src" title="Active news sources" aside={counted ? summary.text : undefined}>
          <ul className="card divide-y divide-[color:var(--line-soft)]">
            {sources.map((s) => {
              const t = sourceTone(s, counted);
              return (
                <li key={s.name} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-[13px]" data-source={s.name}>
                  <span className="flex items-center gap-2 min-w-0 text-ink"><span aria-hidden className={cn('w-2 h-2 rounded-full shrink-0', DOT[t])} /><span className="break-words min-w-0">{s.name}</span></span>
                  {counted && s.count !== null && <span className={cn('tabular text-right min-w-0 max-w-[55%] break-words', t === 'warn' ? 'text-warn-text' : 'text-ink-2')}>{sourceFigure(s)}</span>}
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      {/* (h) disclaimer — always */}
      <Callout tone="neutral" label="Commentary, not advice">{DISCLAIMER}</Callout>
    </div>
  );
}
