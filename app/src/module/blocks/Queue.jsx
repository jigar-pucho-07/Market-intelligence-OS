// Queue — "who do I deal with now". Rows grouped under headings that each come from the metric dictionary
// (Overdue · Due today · Quotes to send), most urgent first, with the record's contact actions and ONE verb per
// row that opens a modal (an outcome sheet that sets stage + next follow-up together). The same block, declared
// with `style: panel`, is the manager's "Needs action" list on the overview: Unassigned → Assign, Drafts not sent
// → Send, Quotes expiring → Follow up. Rows open the record drawer.
//   - type: queue | needs_action
//     entity: leads                                # default entity for groups
//     where: "Assigned_To={{user}}"                # narrows every group on this entity
//     groups:
//       - { metric: overdue, action: log_outcome }                 # entity/label/where/tone from metrics:
//       - { metric: due_today, action: log_outcome }
//       - { label: Quotes to send, entity: quotations, where: "Prepared_By={{user}} and Status=Draft", action: send_quote, link: /my-quotations }
//     limit: 8 · empty: "Nothing due — new follow-ups appear here as they come due." · title: Today's calls
import { useMemo, useState } from 'react';
import { Button } from 'antd';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from '../../lib/router';
import StatusBadge from '../../components/StatusBadge';
import ContactActions from '../../components/ui/ContactActions';
import { Avatar } from '../../components/ui/primitives';
import { ENTITIES } from '../../config/os.config';
import { where } from '../formula';
import { DueChip, dueOrder } from '../due';
import { titleOf, subtitleOf } from '../record';
import { CARD, SECTION_TITLE } from '../Charts';
import Drawer from './Drawer';
import { cn } from '../../utils/cn';

const TONE_BAR = { bad: 'bg-bad', warn: 'bg-warn', ok: 'bg-ok', info: 'bg-info', neutral: 'bg-ink-4', auto: 'bg-ink-4' };

export default function Queue({ block, page, data, user, openModal, reload }) {
  const modals = page.modals ?? [];
  const [open, setOpen] = useState(null);                       // { row, entity }
  const groups = useMemo(() => (block.groups ?? []).map((g) => {
    const base = block.entity ?? page.entity; const entity = g.entity ?? base; const ent = ENTITIES[entity];
    let rows = where(where(data[entity] ?? [], entity === base ? block.where : null, user), g.where, user);
    if (ent?.due) rows = [...rows].sort((a, b) => dueOrder(a, ent) - dueOrder(b, ent));
    const action = g.action ? modals.find((m) => m.id === g.action) : null;
    return { ...g, entity, ent, rows, action, tone: g.tone && g.tone !== 'auto' ? g.tone : (g.metric?.includes('overdue') ? 'bad' : g.metric?.includes('today') ? 'warn' : 'neutral') };
  }), [block, page, data, user, modals]);
  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  const panel = block.type === 'needs_action' || block.style === 'panel';
  const limit = block.limit ?? (panel ? 3 : 8);
  const showContact = block.contact ?? !panel;            // a manager's panel is for deciding, not dialling
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className={CARD} data-os-queue data-os-queue-total={total}>
        <div className="p-4 border-b border-surface-border flex items-baseline justify-between gap-3">
          <h3 className={SECTION_TITLE}>{block.title ?? (panel ? 'Needs action' : "Today's calls")}</h3>
          <span className="text-[12px] text-ink-3 tabular">{total} {total === 1 ? 'item' : 'items'}</span>
        </div>
        {total === 0 && <p className="p-6 text-[13px] text-ink-3">{block.empty ?? (panel ? 'Nothing needs your action right now.' : 'Nothing due — new follow-ups appear here as they come due.')}</p>}
        {groups.filter((g) => g.rows.length).map((g) => (
          <section key={g.label} data-os-queue-group={g.metric ?? g.label} data-os-queue-count={g.rows.length}>
            <header className="flex items-center gap-2 px-4 py-2 bg-surface-2 border-b border-surface-border">
              <span className={cn('w-2 h-2 rounded-full', TONE_BAR[g.tone] ?? 'bg-ink-4')} />
              <span className="text-[13px] font-semibold text-ink">{g.label}</span>
              <span className="chip-count">{g.rows.length}</span>
              {g.link && <Link to={g.link} className="ml-auto text-[12px] font-medium text-primary-600 hover:underline inline-flex items-center gap-1 min-h-8">View all <ArrowRight className="w-3 h-3" /></Link>}
            </header>
            <ul className="divide-y divide-surface-border">
              {g.rows.slice(0, limit).map((r) => {
                const idc = g.ent.id.column; const statusCol = g.ent.status?.column;
                return (
                  <li key={r[idc]} className="px-4 py-3 flex items-center gap-3 hover:bg-black/[0.015] cursor-pointer" onClick={() => setOpen({ row: r, entity: g.entity })} data-os-queue-row>
                    {(g.avatar ?? g.ent.owner) && r[g.avatar ?? g.ent.owner] && <Avatar name={r[g.avatar ?? g.ent.owner]} size={30} />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-ink truncate">{titleOf(r, g.ent)}</span>
                        {statusCol && r[statusCol] && <StatusBadge status={r[statusCol]} size="small" />}
                        <DueChip row={r} ent={g.ent} />
                      </div>
                      <p className="text-[12px] text-ink-3 truncate">{[subtitleOf(r, g.ent), g.sub && r[g.sub]].filter(Boolean).join(' · ') || r[idc]}</p>
                    </div>
                    {showContact && <ContactActions row={r} ent={g.ent} size="sm" labels={false} className="hidden sm:flex" onLog={block.log ? (kind, row) => { const m = modals.find((x) => x.id === block.log); if (m) openModal({ ...m, context: { ...(m.context ?? {}), Type: kind === 'whatsapp' ? 'WhatsApp' : kind === 'email' ? 'Email' : 'Call' } }, row); } : undefined} />}
                    {g.action && <Button size={panel ? 'small' : undefined} type={panel ? 'default' : 'primary'} data-os-action={g.action.id} onClick={(e) => { e.stopPropagation(); openModal(g.action, r); }}>{g.action_label ?? g.action.title}</Button>}
                  </li>
                );
              })}
              {g.rows.length > limit && <li className="px-4 py-2 text-[12px] text-ink-3">{g.rows.length - limit} more{g.link ? <> — <Link to={g.link} className="text-primary-600 hover:underline inline-flex items-center min-h-8">view all</Link></> : ''}</li>}
            </ul>
          </section>
        ))}
      </motion.div>
      {open && <Drawer open onClose={() => setOpen(null)} row={open.row} entity={open.entity} spec={block.drawer ?? {}} data={data} actions={(block.row_actions ?? []).map((id) => modals.find((m) => m.id === id)).filter(Boolean)} onAction={(m, r) => { setOpen(null); openModal(m, r); }} reload={reload} detailRoute={block.detail_route} />}
    </>
  );
}
