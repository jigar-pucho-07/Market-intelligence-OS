// CardGrid — the rows of a table as cards. For records a person reads one at a time rather than
// scans as a column: a staff member's day, a task waiting for verification, a department's load.
// Declared on a table block as `card:`; shown when `view: cards` or the person toggles to it.
//   card: { title, subtitle, avatar, badge, chips, fields: [{key, label, icon}], progress: {value, of, label, tone},
//          callout: {column, label, tone}, tags: {column, label, tone}, actions: [modal ids], columns: 3 }
// Every part renders only when its column has a value — a card never shows an empty callout or a
// "0 / 0" bar to look complete.
import { motion } from 'framer-motion';
import { Button, Dropdown, Tooltip } from 'antd';
import { humanize } from '../../utils/labels';
import { useT } from '../../i18n';
import { ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { Link } from '../../lib/router';
import StatusBadge from '../../components/StatusBadge';
import { Avatar, Callout, Progress, TagList, MetaRow, icon, toneOf } from '../../components/ui/primitives';
import { fmt, guessType } from '../Sections';
import { toNum } from '../formula';
import { containerVariants, itemVariants } from '../Kpis';
import { cn } from '../../utils/cn';
import { DueChip } from '../due';
import ContactActions from '../../components/ui/ContactActions';

export default function CardGrid({ rows, card = {}, ent, actions = [], openModal, onOpen, detailRoute }) {
  const t = useT();
  const idc = ent.id.column; const cols = Math.min(4, Math.max(1, card.columns ?? 3));
  const acts = (card.actions ?? []).map((id) => actions.find((a) => a.id === id)).filter(Boolean);
  // Actions: a menu (⋯) when declared `actions_style: menu` or when there are three or more; otherwise small
  // secondary buttons. Never a full-width primary on every card — one primary per view (audit H8).
  const menu = card.actions_style === 'menu' || acts.length >= 3;
  return (
    <motion.div variants={containerVariants} initial="initial" animate="animate" className={cn('grid grid-cols-1 gap-4 p-4', cols >= 2 && 'md:grid-cols-2', cols >= 3 && 'xl:grid-cols-3', cols >= 4 && '2xl:grid-cols-4')} data-os-card-grid>
      {rows.map((r) => {
        const title = card.title ? r[card.title] : r[idc];
        const sub = Array.isArray(card.subtitle) ? card.subtitle.map((c) => fmt(r, c, ent)).filter((x) => x !== '—').join(' · ') : card.subtitle ? fmt(r, card.subtitle, ent) : null;
        const clickable = !!onOpen; const href = !onOpen && detailRoute ? detailRoute.replace(':id', encodeURIComponent(r[idc])) : null;
        const progress = card.progress ? { value: toNum(r[card.progress.value]), of: card.progress.of_column ? toNum(r[card.progress.of_column]) : (card.progress.of ?? 100) } : null;
        const callout = card.callout && r[card.callout.column];
        const tags = card.tags && r[card.tags.column];
        return (
          <motion.article key={r[idc]} variants={itemVariants} data-os-card-item data-os-card={clickable ? '' : undefined} onClick={clickable ? () => onOpen(r) : undefined}
            className={cn('card p-4 flex flex-col gap-3 min-w-0', clickable && 'card-clickable cursor-pointer')}>
            {/* head: avatar/title/subtitle + badge */}
            <div className="flex items-start gap-3 min-w-0">
              {card.avatar && <Avatar name={r[card.avatar]} size={38} />}
              <div className="min-w-0 flex-1">
                {card.id !== false && card.title && <p className="text-[11px] text-ink-3 tabular mb-0.5">{r[idc]}</p>}
                <h4 className="text-[15px] font-semibold text-ink leading-tight break-words">{href ? <Link to={href} onClick={(e) => e.stopPropagation()} className="hover:underline underline-offset-2 decoration-ink-4">{title}</Link> : title}</h4>
                {sub && <p className="text-[12px] text-ink-3 mt-0.5 break-words">{sub}</p>}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {card.badge && r[card.badge] && <StatusBadge status={r[card.badge]} size="small" />}
                {ent.due && <DueChip row={r} ent={ent} />}
              </div>
              {menu && acts.length > 0 && (
                <span onClick={(e) => e.stopPropagation()}>
                  <Dropdown trigger={['click']} menu={{ items: acts.map((a) => ({ key: a.id, label: a.title, onClick: () => openModal(a, r) })) }}>
                    <Tooltip title={t('More actions')}><button type="button" aria-label={t('More actions')} data-os-card-menu className="no-pill w-8 h-8 rounded-[var(--r-6)] inline-flex items-center justify-center text-ink-3 hover:bg-black/[0.04] hover:text-ink"><MoreHorizontal className="w-4 h-4" /></button></Tooltip>
                  </Dropdown>
                </span>
              )}
              {href && !card.badge && <ArrowUpRight className="w-4 h-4 text-ink-4 shrink-0" />}
            </div>
            {card.chips?.length > 0 && <div className="flex flex-wrap gap-1.5">{card.chips.map((c) => r[c] && <span key={c} className="badge badge-neutral">{r[c]}</span>)}</div>}
            {card.fields?.length > 0 && (
              <div className="space-y-1.5">{card.fields.map((f) => { const v = fmt(r, f.key, ent); if (v === '—' && f.hide_empty !== false) return null; const I = f.icon ? icon(f.icon) : undefined; return (
                <MetaRow key={f.key} icon={I} label={f.label ?? humanize(f.key)}>{guessType(f.key, ent) === 'badge' ? <StatusBadge status={r[f.key]} size="small" /> : v}</MetaRow>); })}</div>
            )}
            {progress && <Progress value={progress.value} of={progress.of} label={card.progress.label} format={card.progress.format ?? (/_INR$|Amount|Value|Price/.test(card.progress.value) ? 'money' : undefined)} tone={card.progress.tone_from ? toneOf(r[card.progress.tone_from]) : (card.progress.tone ?? 'auto')} />}
            {callout && <Callout tone={card.callout.tone ?? 'warn'} label={card.callout.label}>{callout}</Callout>}
            {tags && <div className="flex items-start gap-2 min-w-0">{card.tags.label && <span className="text-[12px] text-ink-3 shrink-0 mt-0.5">{card.tags.label}:</span>}<TagList value={tags} tone={card.tags.tone ?? 'ok'} /></div>}
            {ent.contact && <ContactActions row={r} ent={ent} size="sm" primary={null} />}
            {!menu && acts.length > 0 && (
              <div className="flex gap-2 pt-1 mt-auto" onClick={(e) => e.stopPropagation()}>
                {acts.map((a) => <Button key={a.id} size="small" className="flex-1" danger={a.kind === 'reject' || a.danger} data-os-action={a.id} onClick={() => openModal(a, r)}>{a.title}</Button>)}
              </div>
            )}
          </motion.article>
        );
      })}
    </motion.div>
  );
}
