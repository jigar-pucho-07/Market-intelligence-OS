// Kanban — a table's rows as a pipeline board, one column per stage. Declared on a table block as
// `kanban:`; shown when `view: kanban` or the person toggles to it.
//   kanban: { column: Stage, stages: [New, Contacted, …], title, subtitle, meta: [cols], badge: Score,
//             avatar: Owner, move: { flow, action } | { direct: patch }, colors: { Won: ok, Lost: bad } }
// Drag a card to another column and `move` writes the new stage (payload: id + stage column). Without
// `move` the board is read-only and says so. Native drag events — no library, no bounce.
import { selectProps } from '../../config/popup';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Select } from 'antd';
import { GripVertical, Lock } from 'lucide-react';
import { Link } from '../../lib/router';
import { runAction } from '../../utils/api';
import { Avatar, toneOf, TONE_DOT } from '../../components/ui/primitives';
import { fmt } from '../Sections';
import { DueChip, dueOrder } from '../due';
import { cn } from '../../utils/cn';
import { humanize, sentence } from '../../utils/labels';
import { Tooltip } from 'antd';
import { stageHex } from '../stage';
import ContactActions from '../../components/ui/ContactActions';

export default function Kanban({ rows, kanban, ent, entity, onOpen, detailRoute, reload, openModal, assignModal }) {
  const idc = ent.id.column; const col = kanban.column ?? ent.status?.column;
  // Declared stages first; any value the data holds that was not declared still gets a column, so the
  // board never silently hides records. `locked` stages show their cards but accept no drop (a stage that
  // needs a reason or a modal — Won / Lost / Closed — is entered through its action, not a drag).
  const declared = kanban.stages ?? ent.status?.values ?? [];
  const stages = useMemo(() => [...declared, ...[...new Set(rows.map((r) => r[col]).filter(Boolean))].filter((v) => !declared.includes(v))], [declared, rows, col]);
  const locked = new Set(kanban.locked ?? []);
  const [dragging, setDragging] = useState(null); const [over, setOver] = useState(null); const [busy, setBusy] = useState(null);
  // Within a column the most overdue card is on top (C3): a rep reads the column top-down and calls in that order.
  const byStage = useMemo(() => { const m = Object.fromEntries(stages.map((s) => [s, []])); for (const r of rows) (m[r[col]] ??= []).push(r); if (ent.due) for (const s of Object.keys(m)) m[s].sort((a, b) => dueOrder(a, ent) - dueOrder(b, ent)); return m; }, [rows, stages, col, ent]);
  const canMove = !!kanban.move;
  const tone = (s) => kanban.colors?.[s] ?? toneOf(s);

  const moveTo = async (r, stage) => {
    if (!r || !canMove || r[col] === stage || locked.has(stage)) return;
    setBusy(r[idc]);
    try { await runAction({ ...kanban.move, entity }, { [idc]: r[idc], [col]: stage, ...(kanban.move.context ?? {}) }); toast.success(`${r[kanban.title] ?? r[idc]} → ${stage}`); reload?.(); }
    catch (e) {
      // v4.9 (C2): a refused move names the field the server wants ("Quote value: must be > 0"), in the toast — a card has no form to put it in
      const why = e.errors && Object.entries(e.errors).map(([c, m]) => `${humanize(c)}: ${sentence(m)}`).join(' · ');
      toast.error(e.code === 'NOT_WIRED' ? 'This workflow is not connected yet' : (why ? `Could not move — ${why}` : (e.message || 'Could not move')));
    }
    finally { setBusy(null); }
  };
  const drop = (stage) => { setOver(null); const r = dragging; setDragging(null); moveTo(r, stage); };

  return (
    <div className="p-4 overflow-x-auto custom-scrollbar" data-os-kanban data-os-kanban-move={canMove ? 'true' : 'false'}>
      <div className="flex gap-3 min-w-max items-start">
        {stages.map((s) => (
          <section key={s} data-os-kanban-column={s} data-count={byStage[s]?.length ?? 0} data-locked={locked.has(s) ? 'true' : 'false'}
            onDragOver={canMove && !locked.has(s) ? (e) => { e.preventDefault(); if (over !== s) setOver(s); } : undefined} onDragLeave={() => over === s && setOver(null)} onDrop={canMove && !locked.has(s) ? () => drop(s) : undefined}
            className={cn('w-[264px] shrink-0 rounded-[var(--r-14)] bg-black/[0.025] border border-transparent transition-colors', over === s && dragging && dragging[col] !== s && 'border-primary-300 bg-primary-50/60')}>
            <header className="flex items-center gap-2 px-3 pt-3 pb-2">
              {stageHex(s) ? <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: stageHex(s) }} /> : <span className={cn('w-2 h-2 rounded-full shrink-0', TONE_DOT[tone(s)])} />}
              <h4 className="text-[13px] font-semibold text-ink truncate flex-1" title={s}>{s}</h4>
              <span className="chip-count">{byStage[s]?.length ?? 0}</span>
              {locked.has(s) && <Tooltip title="Set through its action"><Lock className="w-3 h-3 text-ink-4" aria-label="Set through its action" role="img" /></Tooltip>}
            </header>
            <div className="px-2 pb-2 space-y-2 min-h-[72px]">
              {(byStage[s] ?? []).map((r) => {
                const href = !onOpen && detailRoute ? detailRoute.replace(':id', encodeURIComponent(r[idc])) : null;
                return (
                  <article key={r[idc]} draggable={canMove && !locked.has(s)} data-os-kanban-card onDragStart={canMove && !locked.has(s) ? (e) => { setDragging(r); e.dataTransfer.effectAllowed = 'move'; } : undefined} onDragEnd={() => { setDragging(null); setOver(null); }}
                    onClick={onOpen ? () => onOpen(r) : undefined}
                    className={cn('card p-3 space-y-2 min-w-0', (onOpen || href) && 'card-clickable', onOpen && 'cursor-pointer', canMove && !locked.has(s) && 'cursor-grab active:cursor-grabbing', dragging?.[idc] === r[idc] && 'opacity-40', busy === r[idc] && 'animate-pulse-soft')}>
                    <div className="flex items-start gap-2 min-w-0">
                      {canMove && <GripVertical className="w-3.5 h-3.5 text-ink-4 shrink-0 mt-0.5" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-ink leading-tight break-words">{href ? <Link to={href} onClick={(e) => e.stopPropagation()} className="hover:underline underline-offset-2 decoration-ink-4">{r[kanban.title] ?? r[idc]}</Link> : (r[kanban.title] ?? r[idc])}</p>
                        {kanban.subtitle && r[kanban.subtitle] && <p className="text-[11px] text-ink-3 truncate" title={r[kanban.subtitle]}>{r[kanban.subtitle]}</p>}
                      </div>
                      {kanban.badge && r[kanban.badge] !== '' && r[kanban.badge] !== undefined && <span className="badge badge-neutral tabular shrink-0" title={humanize(kanban.badge)}>{kanban.badge_label ?? humanize(kanban.badge)} {r[kanban.badge]}</span>}
                    </div>
                    {(kanban.meta ?? []).map((c) => r[c] ? <p key={c} className="text-[12px] text-ink-2 truncate" title={fmt(r, c, ent)}>{fmt(r, c, ent)}</p> : null)}
                    {ent.due && <div className="pt-0.5"><DueChip row={r} ent={ent} /></div>}
                    {/* footer: owner (or an explicit Assign) + quick contact actions (audit M2 / H2) */}
                    {(kanban.avatar || ent.contact) && (
                      <div className="flex items-center gap-1.5 pt-1 min-w-0">
                        {kanban.avatar && (r[kanban.avatar] ? <><Avatar name={r[kanban.avatar]} size={20} /><span className="text-[12px] text-ink-3 truncate">{r[kanban.avatar]}</span></> : (assignModal && openModal ? <button type="button" className="no-pill text-[12px] font-medium text-warn-text hover:underline" data-os-unassigned onClick={(e) => { e.stopPropagation(); openModal(assignModal, r); }}>Unassigned · Assign</button> : <span className="badge badge-warning">Unassigned</span>))}
                        {ent.contact && <ContactActions row={r} ent={ent} size="sm" labels={false} primary={null} className="ml-auto" />}
                      </div>
                    )}
                    {canMove && !locked.has(s) && (
                      <div className="sm:hidden pt-1" onClick={(e) => e.stopPropagation()}>
                        <Select {...selectProps} size="small" className="w-full" value={undefined} placeholder="Move to…" aria-label="Move to stage" data-os-kanban-move-select popupMatchSelectWidth={false}
                          options={stages.filter((x) => x !== s && !locked.has(x)).map((x) => ({ value: x, label: x }))} onChange={(v) => moveTo(r, v)} />
                      </div>
                    )}
                  </article>
                );
              })}
              {!(byStage[s] ?? []).length && <p className="text-[11px] text-ink-3 text-center py-5">{canMove && !locked.has(s) ? 'Drop here' : 'Empty'}</p>}
            </div>
          </section>
        ))}
      </div>
      {!canMove && <p className="text-[11px] text-ink-3 mt-2">Read-only board — declare <code>kanban.move</code> to allow drag-and-drop.</p>}
    </div>
  );
}
