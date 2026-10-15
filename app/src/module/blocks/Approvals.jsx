// Approvals — inbox of pending items across one or more entities. Approve / reject with a reason, in
// the client's words (`button:`). `layout: list` (default) is one row per item; `layout: cards` is a
// grid of cards with the item's facts and two buttons — the verification-queue shape.
//   sources[]: { entity, label, icon, where, id, title, summary: [cols], date, status, priority, meta: [{icon, label, column}], approve, reject }
import { useMemo, useState } from 'react';
import { Button, Segmented } from 'antd';
import { Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { where, toDate } from '../formula';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { MetaRow, icon } from '../../components/ui/primitives';
import ActionModal from '../ActionModal';
import { fmt } from '../Sections';
import { CARD, SECTION_TITLE } from '../Charts';
import { containerVariants, itemVariants } from '../Kpis';
import { ENTITIES } from '../../config/os.config';
import { cn } from '../../utils/cn';

export default function Approvals({ block, data, reload, user }) {
  const [kind, setKind] = useState('All');
  const items = useMemo(() => block.sources.flatMap((s) => where(data[s.entity] ?? [], s.where, user).map((r) => ({ ...r, __src: s }))).sort((a, b) => (toDate(b[b.__src.date])?.getTime() ?? 0) - (toDate(a[a.__src.date])?.getTime() ?? 0)), [block.sources, data, user]);
  const kinds = ['All', ...block.sources.map((s) => s.label)];
  const shown = kind === 'All' ? items : items.filter((i) => i.__src.label === kind);
  const [modal, setModal] = useState(null);
  const cards = block.layout === 'cards';
  const approve = (s, it) => setModal({ spec: { entity: s.entity, ...s.approve, title: s.approve.title ?? `Approve ${s.label.toLowerCase()}` }, row: it });
  const reject = (s, it) => setModal({ spec: { entity: s.entity, ...s.reject, title: s.reject.title ?? `Reject ${s.label.toLowerCase()}` }, row: it });
  return (
    <div className={CARD} data-os-approvals data-os-layout={cards ? 'cards' : 'list'}>
      <div className="p-4 border-b border-[color:var(--hair-5)] flex flex-wrap items-center justify-between gap-3">
        <h3 className={SECTION_TITLE}>{block.title ?? 'Pending approvals'} · {items.length}</h3>
        {kinds.length > 2 && <div className="max-w-full overflow-x-auto custom-scrollbar" data-os-tabstrip><Segmented size="small" options={kinds} value={kind} onChange={setKind} /></div>}
      </div>
      {shown.length === 0 ? <div className="p-8"><EmptyState icon={icon('CheckCircle2')} title={block.empty ?? 'Nothing waiting'} description="All caught up." /></div> : cards ? (
        <motion.div variants={containerVariants} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
          {shown.map((it, i) => { const s = it.__src; const ent = ENTITIES[s.entity]; return (
            <motion.article key={i} variants={itemVariants} className="card p-4 flex flex-col gap-3 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-ink-3 tabular">{it[s.id]}</p>
                  <h4 className="text-[15px] font-semibold text-ink leading-tight break-words">{it[s.title]}</h4>
                  {block.sources.length > 1 && <p className="text-[11px] text-ink-3 mt-0.5">{s.label}</p>}
                </div>
                {s.priority && it[s.priority] && <StatusBadge status={it[s.priority]} size="small" />}
                {!s.priority && s.status && it[s.status] && <StatusBadge status={it[s.status]} size="small" />}
              </div>
              <div className="space-y-1.5">
                {(s.meta ?? (s.summary ?? []).map((c) => ({ column: c }))).map((m) => { const v = fmt(it, m.column, ent); if (v === '—') return null; return <MetaRow key={m.column} icon={m.icon ? icon(m.icon) : undefined} label={m.label ?? m.column.replace(/_/g, ' ')}>{v}</MetaRow>; })}
                {s.date && it[s.date] && <MetaRow icon={icon('Calendar')} label="Due">{format(toDate(it[s.date]) ?? new Date(), 'dd MMM yyyy')}</MetaRow>}
              </div>
              <div className="flex gap-2 pt-1 mt-auto">
                <Button data-os-action={`${s.label}-approve`} type="primary" className="flex-1" icon={<Check className="w-3.5 h-3.5" />} onClick={() => approve(s, it)}>{s.approve.button ?? s.approve.title ?? 'Approve'}</Button>
                <Button data-os-action={`${s.label}-reject`} danger className="flex-1" icon={<X className="w-3.5 h-3.5" />} onClick={() => reject(s, it)}>{s.reject.button ?? s.reject.title ?? 'Reject'}</Button>
              </div>
            </motion.article>); })}
        </motion.div>
      ) : (
        <div className="divide-y divide-black/[0.05]">
          {shown.map((it, i) => { const s = it.__src; const I = icon(s.icon); return (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.28 }} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-black/[0.04] flex items-center justify-center shrink-0"><I className="w-4 h-4 text-ink-2" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] font-medium uppercase tracking-[0.04em] text-ink-3">{s.label}</span><span className="text-[12px] text-ink-3 tabular">{it[s.id]}</span>{s.status && <StatusBadge status={it[s.status]} size="small" />}{s.priority && it[s.priority] && <StatusBadge status={it[s.priority]} size="small" />}</div>
                <p className="text-[14px] font-semibold text-ink truncate">{it[s.title]}</p>
                <p className="text-[12px] text-ink-3 truncate">{(s.summary ?? []).map((c) => it[c]).filter(Boolean).join(' · ')}{s.date && it[s.date] ? ` · ${format(toDate(it[s.date]) ?? new Date(), 'dd MMM')}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button data-os-action={`${s.label}-approve`} type="primary" icon={<Check className="w-3.5 h-3.5" />} onClick={() => approve(s, it)}>{s.approve.button ?? s.approve.title ?? 'Approve'}</Button>
                <Button data-os-action={`${s.label}-reject`} danger icon={<X className="w-3.5 h-3.5" />} onClick={() => reject(s, it)}>{s.reject.button ?? s.reject.title ?? 'Reject'}</Button>
              </div>
            </motion.div>); })}
        </div>
      )}
      {modal && <ActionModal spec={modal.spec} row={modal.row} open onClose={() => setModal(null)} data={data} onDone={reload} />}
    </div>
  );
}
