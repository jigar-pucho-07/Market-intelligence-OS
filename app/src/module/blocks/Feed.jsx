// Feed — notice board / activity stream. Newest first. `style: timeline` draws the entries on a vertical
// line with a status dot (a lead's history, an audit trail); the default is a list with an icon.
import { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { where, toDate } from '../formula';
import StatusBadge from '../../components/StatusBadge';
import { icon } from '../Kpis';
import { CARD, SECTION_TITLE } from '../Charts';
import { toneOf, TONE_DOT } from '../../components/ui/primitives';
import { cn } from '../../utils/cn';

export default function Feed({ block, data, user, onOpen }) {
  const rows = useMemo(() => [...where(data[block.entity] ?? [], block.where, user)].sort((a, b) => (toDate(b[block.date])?.getTime() ?? 0) - (toDate(a[block.date])?.getTime() ?? 0)).slice(0, block.limit ?? 10), [data, block, user]);
  const I = icon(block.icon ?? 'Megaphone');
  const day = (d) => (isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'dd MMM'));
  const timeline = block.style === 'timeline';
  return (
    <div className={block.bare ? '' : CARD} data-os-feed>
      {!block.bare && <div className="p-4 border-b border-[color:var(--hair-5)] flex items-baseline justify-between"><h3 className={SECTION_TITLE}>{block.title ?? 'Notice board'}</h3><span className="text-[12px] text-ink-3 tabular">{rows.length}</span></div>}
      {timeline ? (
        <ol className="relative ml-[22px] my-5 mr-4 border-l border-black/[0.08] space-y-4" data-os-timeline>
          {rows.map((r, i) => { const d = toDate(r[block.date]); const t = toneOf(r[block.status]); return (
            <li key={i} className={cn('pl-5 relative', onOpen && 'cursor-pointer hover:bg-black/[0.015] -mx-2 px-2 rounded-[var(--r-6)]')} onClick={onOpen ? () => onOpen(r) : undefined} data-os-timeline-item>
              <span className={cn('absolute -left-[5px] top-1.5 w-[9px] h-[9px] rounded-full border-2 border-white', TONE_DOT[t] ?? 'bg-ink-4')} />
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex items-center gap-2 flex-wrap">{block.by && r[block.by] && <span className="text-[13px] font-semibold text-ink">{r[block.by]}</span>}{block.status && r[block.status] && <StatusBadge status={r[block.status]} size="small" />}{(!block.by || !r[block.by]) && <span className="text-[13px] font-semibold text-ink">{r[block.title_column]}</span>}</div>
                {d && <span className="text-[11px] text-ink-3 tabular whitespace-nowrap">{format(d, 'dd MMM yyyy, HH:mm')}</span>}
              </div>
              {block.by && r[block.by] && block.title_column && r[block.title_column] && <p className="text-[13px] text-ink mt-0.5">{r[block.title_column]}</p>}
              {block.body && r[block.body] && <p className="text-[13px] text-ink-2 mt-0.5 line-clamp-3 break-words">{r[block.body]}</p>}
            </li>); })}
        </ol>
      ) : (
        <div className="divide-y divide-black/[0.05]">
          {rows.map((r, i) => { const d = toDate(r[block.date]); return (
            <div key={i} className="p-4 flex gap-3">
              <div className="w-9 h-9 rounded-full bg-black/[0.04] flex items-center justify-center shrink-0"><I className="w-4 h-4 text-ink-2" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap"><p className="text-[14px] font-semibold text-ink">{r[block.title_column]}</p>{block.status && <StatusBadge status={r[block.status]} size="small" />}</div>
                {block.body && <p className="text-[13px] text-ink-2 mt-0.5 line-clamp-3 break-words">{r[block.body]}</p>}
                <p className="text-[11px] text-ink-3 mt-1">{d ? day(d) : ''}{block.by && r[block.by] ? ` · ${r[block.by]}` : ''}</p>
              </div>
            </div>); })}
        </div>
      )}
      {!rows.length && <p className="p-6 text-[13px] text-ink-3">{block.empty ?? 'Nothing posted yet.'}</p>}
    </div>
  );
}
