// Drawer — the record pop-up every table row opens. Three zones (audit H5):
//   1 header — name, "company · id" subtitle, a score pill (`score:` column), stage chip + due chip + owner,
//              then ONE action row: Call · WhatsApp (from the entity's `contact:`), the primary verb, a stage
//              button, and ⋯ for the rest; "Open full page" when a detail route exists (C1).
//   2 tabs   — `tabs: [{ label, sections }]` (a count is added when a tab's first section lists rows), or the
//              sections in one column when no tabs are declared. Default: every column of the record, empties hidden.
//   3 body   — the same section vocabulary as a detail page, rendered compact.
// `placement: center` renders the same content as a centred dialog instead of a right-hand panel.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '../../lib/router';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, MoreHorizontal, ArrowRightLeft } from 'lucide-react';
import { Button, Dropdown, Tooltip } from 'antd';
import StatusBadge from '../../components/StatusBadge';
import ContactActions from '../../components/ui/ContactActions';
import { Avatar } from '../../components/ui/primitives';
import { ENTITIES } from '../../config/os.config';
import { useAuth } from '../../context/AuthContext';
import { D, E, prefersReducedMotion } from '../../config/motion';
import { renderSection, relatedRows } from '../Sections';
import { DueChip } from '../due';
import { titleOf, subtitleOf } from '../record';
import { cn } from '../../utils/cn';
import { useT } from '../../i18n';

export default function Drawer({ open, onClose, row, entity, spec = {}, data = {}, actions = [], onAction, reload, detailRoute }) {
  const { user } = useAuth(); const t = useT();
  const ent = ENTITIES[entity]; const idc = ent?.id?.column; const statusCol = ent?.status?.column;
  const tabs = spec.tabs?.length ? spec.tabs : null;
  const sections = spec.sections ?? [{ type: 'fields', hide_empty: true }];      // every column of the record, empties hidden (H5)
  const [tab, setTab] = useState(0);
  const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) setTab(0); }, [open, row?.[idc]]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!open) return; const on = (e) => { if (e.key === 'Escape') onClose?.(); }; window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on); }, [open, onClose]);
  const still = prefersReducedMotion();
  const center = spec.placement === 'center';
  const ctx = row ? { row, ent, idc, data, reload, user, t, compact: true, actions, openModal: (m, r) => onAction?.(m, r ?? row) } : null;
  // Action row: contact links, then the primary verb, then a stage change, then the rest under ⋯.
  const primary = actions.find((a) => a.primary) ?? actions.find((a) => a.kind === 'custom' || a.kind === 'create') ?? actions[0];
  const stage = actions.find((a) => a.kind === 'status' && a !== primary);
  const rest = actions.filter((a) => a !== primary && a !== stage);
  const scoreCol = spec.score ?? (ent?.columns?.includes('Score') ? 'Score' : null);
  const ownerCol = spec.owner ?? ent?.owner;
  const counts = useMemo(() => (tabs ?? []).map((t) => { const s = (t.sections ?? []).find((x) => ['related', 'timeline', 'list', 'linked'].includes(x.type)); return s && ctx ? relatedRows(s, ctx).length : null; }), [tabs, ctx]);
  const body = tabs ? (tabs[tab]?.sections ?? []) : sections;
  const sub = row ? [subtitleOf(row, ent, spec), row[idc]].filter(Boolean) : [];
  if (!mounted) return null;   // a portal to <body>: nothing on the server, nothing before hydration (Modal does the same)
  return createPortal(
    <AnimatePresence>
      {open && row && (
        <div className="fixed inset-0 z-[90]" data-os-drawer>
          <motion.div className="absolute inset-0 bg-black/25" initial={{ opacity: still ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: D.QUICK }} onClick={onClose} />
          <motion.aside role="dialog" aria-modal="true" aria-label={titleOf(row, ent, spec)} data-os-drawer-placement={center ? 'center' : 'right'}
            initial={center ? { opacity: still ? 1 : 0, x: '-50%', y: still ? '-50%' : 'calc(-50% + 8px)' } : { x: still ? 0 : '100%' }} animate={center ? { opacity: 1, x: '-50%', y: '-50%' } : { x: 0 }} exit={center ? { opacity: 0, x: '-50%', y: '-50%' } : { x: '100%' }} transition={{ duration: D.BASE, ease: E.OUT }}
            className={center ? 'absolute left-1/2 top-1/2 w-[calc(100vw-2rem)] sm:w-[640px] max-h-[90vh] bg-white shadow-overlay flex flex-col rounded-[var(--r-12)]' : 'absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-overlay flex flex-col sm:rounded-l-[var(--r-12)]'}>
            {/* Zone 1 — header */}
            <div className="p-5 border-b border-surface-border space-y-3" data-os-drawer-header>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[18px] font-semibold text-ink truncate" data-os-drawer-title>{titleOf(row, ent, spec)}</h2>
                  {sub.length > 0 && <p className="text-[12px] text-ink-3 truncate mt-0.5">{sub[0]}{sub.length > 1 && <> · <span className="font-mono text-ink-2">{sub[1]}</span></>}</p>}
                </div>
                {scoreCol && row[scoreCol] !== '' && row[scoreCol] !== undefined && <span className="badge badge-neutral tabular text-[12px] shrink-0" data-os-score>Score {row[scoreCol]}</span>}
                <Tooltip title={t('Close')}><button onClick={onClose} aria-label={t('Close')} className="no-pill w-9 h-9 rounded-[var(--r-8)] hover:bg-black/[0.04] flex items-center justify-center shrink-0 text-ink-2 -mr-1 -mt-1"><X className="w-4 h-4" /></button></Tooltip>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {statusCol && row[statusCol] && <StatusBadge status={row[statusCol]} />}
                <DueChip row={row} ent={ent} />
                {ownerCol && (row[ownerCol] ? <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2"><Avatar name={row[ownerCol]} size={18} />{row[ownerCol]}</span> : <span className="badge badge-warning">{t('Unassigned')}</span>)}
                {detailRoute && row[idc] && <Link to={detailRoute.replace(':id', encodeURIComponent(row[idc]))} onClick={onClose} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary-600 hover:underline ml-auto" data-os-open-page>{t('Open full page')} <ArrowUpRight className="w-3.5 h-3.5" /></Link>}
              </div>
              {(ent?.contact || actions.length > 0) && (
                <div className="flex items-center gap-2 flex-wrap" data-os-drawer-actions>
                  <ContactActions row={row} ent={ent} onLog={spec.log ? (kind) => { const m = actions.find((a) => a.id === spec.log); if (m) onAction?.({ ...m, context: { ...(m.context ?? {}), Type: kind === 'whatsapp' ? 'WhatsApp' : kind === 'email' ? 'Email' : 'Call' } }, row); } : undefined} />
                  {primary && <Button type={ent?.contact ? 'default' : 'primary'} data-os-action={primary.id} onClick={() => onAction(primary, row)}>{primary.title}</Button>}
                  {stage && <Button data-os-action={stage.id} icon={<ArrowRightLeft className="w-3.5 h-3.5" />} onClick={() => onAction(stage, row)}>{stage.title}</Button>}
                  {rest.length > 0 && (
                    <Dropdown trigger={['click']} menu={{ items: rest.map((a) => ({ key: a.id, label: <span data-os-action={a.id}>{a.title}</span>, onClick: () => onAction(a, row) })) }}>
                      <Tooltip title={t('More actions')}><Button aria-label={t('More actions')} icon={<MoreHorizontal className="w-4 h-4" />} data-os-drawer-more /></Tooltip>
                    </Dropdown>
                  )}
                </div>
              )}
            </div>
            {/* Zone 2 — tabs */}
            {tabs && (
              <div className="flex gap-1 px-5 pt-3 border-b border-surface-border" role="tablist" data-os-drawer-tabs>
                {tabs.map((t, i) => <button key={t.label} role="tab" aria-selected={i === tab} onClick={() => setTab(i)} className={cn('no-pill px-3 pb-2.5 -mb-px text-[13px] font-medium border-b-2 transition-colors', i === tab ? 'border-ink text-ink' : 'border-transparent text-ink-3 hover:text-ink')}>{t.label}{counts[i] !== null && counts[i] !== undefined && <span className="ml-1.5 chip-count">{counts[i]}</span>}</button>)}
              </div>
            )}
            {/* Zone 3 — body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6" data-os-drawer-body>
              {body.map((s, i) => renderSection(s.type === 'fields' && s.hide_empty === undefined ? { ...s, hide_empty: true } : s, i, ctx))}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>, document.body);
}
