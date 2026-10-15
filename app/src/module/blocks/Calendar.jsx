// Calendar — month grid of entity rows by a date column (HR Leave calendar / holidays pattern). Click a day to list its rows.
import { useMemo, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isSameDay, isWithinInterval } from 'date-fns';
import { toDate, where } from '../formula';
import StatusBadge from '../../components/StatusBadge';
import { CARD, SECTION_TITLE } from '../Charts';

const COLORS = ['bg-primary-500', 'bg-[color:var(--cat-3)]', 'bg-[color:var(--cat-4)]', 'bg-[color:var(--cat-8)]', 'bg-[color:var(--cat-7)]', 'bg-[color:var(--cat-6)]'];

export default function Calendar({ block, rows, onOpen, user }) {
  const [month, setMonth] = useState(() => { const ds = rows.map((r) => toDate(r[block.date])).filter(Boolean); return ds.length ? startOfMonth(new Date(Math.max(...ds))) : startOfMonth(new Date()); });
  const [sel, setSel] = useState(null);
  const src = useMemo(() => where(rows, block.where, user), [rows, block.where, user]);
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const colorOf = useMemo(() => { const vals = [...new Set(src.map((r) => r[block.color_by]).filter(Boolean))]; return (v) => COLORS[Math.max(0, vals.indexOf(v)) % COLORS.length]; }, [src, block.color_by]);
  const onDay = (d) => src.filter((r) => { const a = toDate(r[block.date]); if (!a) return false; const b = block.end ? toDate(r[block.end]) : null; return b ? isWithinInterval(d, { start: a, end: b }) : isSameDay(a, d); });
  const list = sel ? onDay(sel) : [];
  return (
    <div className={`${CARD} p-5`} data-os-calendar>
      <div className="flex items-center justify-between mb-4">
        <h3 className={SECTION_TITLE}>{block.title ?? 'Calendar'}</h3>
        <div className="flex items-center gap-2">
          <Tooltip title="Previous month"><Button size="small" icon={<ChevronLeft className="w-4 h-4" />} onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" /></Tooltip>
          <span className="text-sm font-semibold w-32 text-center">{format(month, 'MMMM yyyy')}</span>
          <Tooltip title="Next month"><Button size="small" icon={<ChevronRight className="w-4 h-4" />} onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" /></Tooltip>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-500 mb-1">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => { const items = onDay(d); const active = sel && isSameDay(sel, d); return (
          <button key={d.toISOString()} onClick={() => setSel(d)} className={`min-h-[64px] rounded-xl border p-1.5 text-left transition-colors ${isSameMonth(d, month) ? 'bg-white' : 'bg-gray-50 text-ink-3'} ${active ? 'border-primary-500 ring-1 ring-primary-500' : 'border-surface-border hover:border-primary-300'}`}>
            <span className={`text-xs font-semibold ${isSameDay(d, new Date()) ? 'text-primary-600' : ''}`}>{format(d, 'd')}</span>
            <div className="mt-1 space-y-0.5">{items.slice(0, 2).map((r, i) => <div key={i} className={`h-1.5 rounded-full ${colorOf(r[block.color_by])}`} title={r[block.label] ?? ''} />)}{items.length > 2 && <span className="text-[10px] text-gray-500">+{items.length - 2}</span>}</div>
          </button>); })}
      </div>
      {sel && (
        <div className="mt-4 border-t border-surface-border pt-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">{format(sel, 'EEEE, d MMMM')} · {list.length} {list.length === 1 ? 'entry' : 'entries'}</p>
          <div className="space-y-1.5">{list.map((r, i) => <button key={i} onClick={() => onOpen?.(r)} className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-primary-50 text-left"><span className="text-sm font-semibold text-gray-900 truncate">{r[block.label] ?? r[block.color_by]}</span>{block.status && <StatusBadge status={r[block.status]} />}</button>)}{!list.length && <p className="text-sm text-gray-500">Nothing on this day.</p>}</div>
        </div>
      )}
    </div>
  );
}
