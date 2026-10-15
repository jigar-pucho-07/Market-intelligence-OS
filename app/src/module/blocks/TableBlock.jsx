// TableBlock — the records block. Search, filters, pagination. Clicking a row ALWAYS opens the record —
// a right-hand drawer by default (`drawer: { placement: center }` for a centred pop-up), with the row's
// actions in its footer and, when the entity has a detail page, an "Open full page" link. `drawer: false`
// opts out. Four views of the same rows — `table` (default), `cards` (with a `card:` spec), `kanban`
// (with a `kanban:` spec) and `grouped` (with a `group:` spec); `views: [table, kanban]` shows a toggle. `segments: { column }` puts status chips with live counts above the toolbar; `period:
// { column, presets }` adds date presets; a KPI with `filter:` on the same page narrows this table when
// clicked. Every filter is a `where` clause over the same rows, so the count in a chip is the count in
// the table.
import { useT } from '../../i18n';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from 'antd';
import { Pencil, ArrowRightLeft, MoreHorizontal, FileText } from 'lucide-react';
import DataTable from '../../components/DataTable';
import EmptyState from '../../components/EmptyState';
import { TableRowSkeleton } from '../../components/Skeleton';
import { Chip, ChipRow, ViewToggle } from '../../components/ui/primitives';
import Toolbar from '../Toolbar';
import Drawer from './Drawer';
import CardGrid from './CardGrid';
import Kanban from './Kanban';
import Grouped from './Grouped';
import Feed from './Feed';
import { renderCell } from '../cells';
import { useSearch } from '../../hooks/useEntity';
import { where, toDate } from '../formula';
import { CARD } from '../Charts';
import { icon } from '../Kpis';
import { ENTITIES } from '../../config/os.config';
import { labelOf } from '../../utils/labels';
import { Tooltip } from 'antd';
import { startOfDay, subDays, startOfMonth } from 'date-fns';

const ROW_ICONS = { edit: Pencil, status: ArrowRightLeft, custom: MoreHorizontal, document: FileText };

function inPeriod(rows, column, preset) {
  if (!column || !preset || preset === 'all') return rows;
  const t = startOfDay(new Date()); const from = { today: t, yesterday: subDays(t, 1), '7d': subDays(t, 7), '30d': subDays(t, 30), month: startOfMonth(t) }[preset];
  const to = preset === 'yesterday' ? t : preset === 'today' ? new Date(t.getTime() + 864e5) : null;
  if (!from) return rows;
  return rows.filter((r) => { const d = toDate(r[column]); return d && d >= from && (!to || d < to); });
}

export default function TableBlock({ block, page, rows, loading, data, openModal, detailRoute, user, extraWhere, reload }) {
  const t = useT();
  const entity = block.entity ?? page.entity; const ent = ENTITIES[entity];
  const src = useMemo(() => where(where(rows, block.where, user), extraWhere, user), [rows, block.where, extraWhere, user]);
  const [segment, setSegment] = useState(null);
  const [period, setPeriod] = useState(block.period?.default ?? 'all');
  const seg = block.segments; const segCol = seg?.column ?? ent?.status?.column;
  const segValues = useMemo(() => !seg ? [] : seg.values ? seg.values : (segCol === ent?.status?.column && ent?.status?.values) ? ent.status.values : [...new Set(src.map((r) => r[segCol]).filter(Boolean))].sort(), [seg, segCol, ent, src]);
  const periodRows = useMemo(() => inPeriod(src, block.period?.column ?? ent?.created, period), [src, block.period, ent, period]);
  const counts = useMemo(() => { const c = {}; for (const r of periodRows) c[r[segCol]] = (c[r[segCol]] || 0) + 1; return c; }, [periodRows, segCol]);
  const segRows = useMemo(() => (segment ? periodRows.filter((r) => r[segCol] === segment) : periodRows), [periodRows, segment, segCol]);
  const { q, setQ, active, setActive, filtered } = useSearch(segRows, block.search ?? [], {});
  const [drawerRow, setDrawerRow] = useState(null);
  const views = block.views ?? [block.view ?? (block.group ? 'grouped' : 'table')];
  const [view, setView] = useState(block.view ?? views[0]);
  // Every row opens: the drawer is the kernel default, not an opt-in.
  const drawer = block.drawer === false ? null : (block.drawer && typeof block.drawer === 'object' ? block.drawer : {});
  useEffect(() => { setSegment(null); }, [extraWhere]);
  const modals = page.modals ?? [];
  const headerActions = (block.actions?.header ?? page.actions?.header ?? []).map((id) => modals.find((m) => m.id === id)).filter(Boolean);
  const rowActions = (block.actions?.row ?? page.actions?.row ?? []).map((id) => modals.find((m) => m.id === id)).filter(Boolean);
  const label = block.label ?? page.label;
  // `owner:` column with an empty value shows "Unassigned · Assign" that opens the block's `assign` modal (M9).
  const assignModal = modals.find((m) => m.id === (block.assign ?? 'assign'));
  const cellCtx = { detailRoute, ent, onUnassigned: assignModal ? (r) => openModal(assignModal, r) : undefined };
  const columns = useMemo(() => {
    const cols = (block.columns ?? []).map((c) => ({ accessorKey: c.key, header: labelOf(t, c.key, c.header ?? c.label), meta: { priority: c.priority }, cell: ({ getValue, row }) => renderCell(c, getValue(), row.original, cellCtx) }));
    if (rowActions.length && (!drawer || block.row_actions === 'inline')) cols.push({ id: '_actions', header: '', cell: ({ row }) => (
      <div className="flex items-center gap-1">{rowActions.map((m) => { const I = ROW_ICONS[m.kind] ?? MoreHorizontal; return (
        <Tooltip key={m.id} title={t(m.title)}><button type="button" data-os-action={m.id} aria-label={t(m.title)} onClick={(e) => { e.stopPropagation(); openModal(m, row.original); }} className="no-pill p-2 rounded-[var(--r-8)] text-ink-3 hover:text-ink hover:bg-black/[0.04] transition-colors"><I className="w-4 h-4" /></button></Tooltip>); })}</div>) });
    return cols;
  }, [block, rowActions, detailRoute, openModal, drawer, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const onOpen = drawer ? (r) => setDrawerRow(r) : undefined;
  // Bulk actions: `bulk: [assign, stage]` adds row checkboxes and a bar; the modal runs once, its payload is applied to every selected row.
  const bulkActions = (block.bulk ?? []).map((id) => modals.find((m) => m.id === id)).filter(Boolean);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const idc = ent?.id?.column; const rowId = (r) => r[idc];
  const selectedRows = useMemo(() => filtered.filter((r) => selectedIds.has(rowId(r))), [filtered, selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSelectedIds(new Set()); }, [segment, period, q, view]);
  const exportSelected = () => { const cols = ent.columns; const csv = [cols.join(','), ...selectedRows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${entity}-selected.csv`; a.click(); };
  // Empty states say why and offer the next step (M6): `empty: { title, reason, action }` or plain text.
  const emptySpec = typeof block.empty === 'object' ? block.empty : { reason: block.empty };
  const filtering = !!q || !!segment || period !== 'all' || Object.values(active).some(Boolean) || !!extraWhere;
  const emptyAction = emptySpec.action ? modals.find((m) => m.id === emptySpec.action) : headerActions[0];
  const empty = <div className="p-8"><EmptyState icon={icon(page.icon)} title={filtering ? t('No matches') : (emptySpec.title ?? block.empty_title ?? `No ${label.toLowerCase()} yet`)} description={filtering ? 'Nothing matches these filters — clear a filter or widen the period.' : (emptySpec.reason ?? `New ${label.toLowerCase()} will appear here as they are added.`)} action={filtering ? { label: t('Clear filters'), onClick: () => { setQ(''); setSegment(null); setPeriod(block.period?.default ?? 'all'); setActive({}); } } : emptyAction ? { label: emptyAction.title, onClick: () => openModal(emptyAction, null) } : undefined} /></div>;
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className={CARD} data-os-table data-os-view={view}>
        {seg && (
          <ChipRow className="px-4 pt-4 mx-0" data-os-segments data-os-segments-total={periodRows.length}>
            {seg.all !== false && <Chip label={typeof seg.all === 'string' ? t(seg.all) : `${t('All')} ${t(label).toLowerCase()}`} count={periodRows.length} pressed={!segment} onClick={() => setSegment(null)} />}
            {segValues.map((v) => <Chip key={v} label={t(v)} count={counts[v] ?? 0} pressed={segment === v} onClick={() => setSegment(segment === v ? null : v)} />)}
          </ChipRow>
        )}
        <Toolbar label={label} q={q} setQ={setQ} filters={block.filters ?? []} rows={src} active={active} setActive={setActive} count={filtered.length} data={data}
          period={block.period} periodValue={period} setPeriod={setPeriod}
          right={views.length > 1 ? <ViewToggle value={view} options={views} onChange={setView} /> : null} />
        {loading ? <div className="p-4">{[1, 2, 3, 4, 5].map((i) => <TableRowSkeleton key={i} columns={columns.length} />)}</div>
          : filtered.length === 0 && view !== 'kanban' ? empty
          : view === 'cards' && block.card ? <CardGrid rows={filtered} card={block.card} ent={ent} actions={rowActions} openModal={openModal} onOpen={onOpen} detailRoute={detailRoute} />
          : view === 'kanban' && block.kanban ? <Kanban rows={filtered} kanban={block.kanban} ent={ent} entity={entity} onOpen={onOpen} detailRoute={detailRoute} reload={reload} openModal={openModal} assignModal={assignModal} />
          : view === 'grouped' && block.group ? <Grouped rows={filtered} group={block.group} columns={columns} onOpen={onOpen} />
          : view === 'timeline' && block.timeline ? <Feed block={{ ...block.timeline, entity, style: 'timeline', title: block.timeline.title ?? label, limit: block.timeline.limit ?? filtered.length, bare: true }} data={{ ...data, [entity]: filtered }} user={user} onOpen={onOpen} />
          : <DataTable data={filtered} columns={columns} pageSize={block.pageSize ?? 10} onRowClick={onOpen} selectable={bulkActions.length > 0} selected={selectedIds} onSelect={setSelectedIds} rowId={rowId} />}
        {bulkActions.length > 0 && selectedRows.length > 0 && view === 'table' && (
          <div className="sticky bottom-0 flex items-center gap-2 flex-wrap px-4 py-3 border-t border-[color:var(--hair-6)] bg-white" data-os-bulk-bar>
            <span className="text-[13px] font-medium text-ink mr-2">{selectedRows.length} {t('selected')}</span>
            {bulkActions.map((m) => <Button key={m.id} size="small" data-os-bulk={m.id} onClick={() => openModal({ ...m, bulk: true, title: `${m.title} · ${selectedRows.length} ${selectedRows.length === 1 ? 'record' : 'records'}` }, selectedRows)}>{m.title}</Button>)}
            <Button size="small" onClick={exportSelected} data-os-bulk="export">{t('Export selected')}</Button>
            <button type="button" className="no-pill ml-auto text-[12px] text-ink-3 hover:text-ink" onClick={() => setSelectedIds(new Set())}>{t('Clear')}</button>
          </div>
        )}
      </motion.div>
      {drawer && <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} row={drawerRow} entity={entity} spec={drawer} data={data} actions={rowActions} detailRoute={detailRoute} onAction={(m, r) => { setDrawerRow(null); openModal(m, r); }} reload={reload} />}
    </>
  );
}
