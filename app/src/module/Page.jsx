// Page — renders any page from its os.yaml `blocks`. The classic keys (kpis/charts/table/modals/tabs) are normalised into blocks by the scaffold.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from '../lib/router';
import { motion } from 'framer-motion';
import { Button, Tooltip } from 'antd';
import { Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { modalEntities } from './Fields';
import Kpis, { pageVariants, containerVariants, itemVariants } from './Kpis';
import Charts from './Charts';
import ActionModal from './ActionModal';
import TableBlock from './blocks/TableBlock';
import Tabs from './blocks/Tabs';
import Calendar from './blocks/Calendar';
import Stepper from './blocks/Stepper';
import Approvals from './blocks/Approvals';
import ActionCard from './blocks/ActionCard';
import Feed from './blocks/Feed';
import Queue from './blocks/Queue';
import Form from './blocks/Form';
import DocumentPreview from './DocumentPreview';
import ListPdf from './ListPdf';
import Drawer from './blocks/Drawer';
import { Callout } from '../components/ui/primitives';
import { useEntity, useEntities } from '../hooks/useEntity';
import { downloadCSV } from '../utils/api';
import { CUSTOM } from '../custom';
import { useT } from '../i18n';
import { DOCUMENTS, ENTITIES } from '../config/os.config';
import { where as whereRows } from './formula';
const DOC_ENTITIES = Object.fromEntries(Object.entries(DOCUMENTS).map(([k, d]) => [k, [d.entity, d.items?.entity].filter(Boolean)]));

function* walkAll(blocks) { for (const b of blocks ?? []) { yield b; yield* walkAll(b.blocks); for (const t of b.tabs ?? []) yield* walkAll(t.blocks); } }
function collectEntities(blocks, acc) {
  for (const b of blocks ?? []) {
    if (b.entity) acc.add(b.entity);
    for (const k of b.kpis ?? []) if (k.entity) acc.add(k.entity);
    for (const c of b.charts ?? []) if (c.entity) acc.add(c.entity);
    for (const s of b.sources ?? []) acc.add(s.entity);
    for (const s of b.drawer?.sections ?? []) if (s.entity) acc.add(s.entity);
    for (const t of b.drawer?.tabs ?? []) for (const s of t.sections ?? []) if (s.entity) acc.add(s.entity);
    for (const g of b.groups ?? []) if (g.entity) acc.add(g.entity);
    for (const t of b.tabs ?? []) collectEntities(t.blocks, acc);
    collectEntities(b.blocks, acc);
  }
  return acc;
}

export default function Page({ config }) {
  const { user } = useAuth(); const t = useT();
  const { rows, loading, reload } = useEntity(config.entity);
  const extra = useMemo(() => { const acc = collectEntities(config.blocks, new Set()); for (const m of config.modals ?? []) if (m.kind === 'document' && DOC_ENTITIES[m.document]) DOC_ENTITIES[m.document].forEach((e) => acc.add(e)); for (const m of config.modals ?? []) modalEntities(m, DOCUMENTS).forEach((e) => acc.add(e)); for (const s of config.drawer?.sections ?? []) if (s.entity) acc.add(s.entity); acc.delete(config.entity); return [...acc]; }, [config]);
  const { data: extraData, loading: extraLoading } = useEntities(extra);
  const data = useMemo(() => (config.entity ? { ...extraData, [config.entity]: rows } : extraData), [extraData, rows, config.entity]);
  const busy = loading || extraLoading;
  const [modal, setModal] = useState(null);
  const [drawerRow, setDrawerRow] = useState(null);
  // `export: { format: pdf, ... }` (24 Oct 2026): Export opens a designed PDF of the rows the page's table is showing.
  const pdfExport = config.export && typeof config.export === 'object' && config.export.format === 'pdf' ? config.export : null;
  const [shown, setShown] = useState(null);
  const [listPdf, setListPdf] = useState(false);
  // A KPI with `filter:` is a button: clicking it narrows the tables on this page to that clause.
  const [kpi, setKpi] = useState(null);
  // A document action in the page header has no row: it prints the newest record its `where:` matches (24 Oct 2026, e.g. today's
  // report as a PDF from the Today page). Newest = the modal's `date:` column, else the entity's created column.
  const openModal = (spec, row) => {
    if (spec?.kind === 'document' && !row) {
      const doc = DOCUMENTS[spec.document]; const e = doc?.entity;
      const list = e ? whereRows(data[e] ?? [], spec.where, user) : [];
      const dc = spec.date ?? ENTITIES[e]?.created;
      const pick = [...list].sort((a, b) => (Date.parse(b?.[dc]) || 0) - (Date.parse(a?.[dc]) || 0))[0];
      if (!pick) { toast.error(t(spec.empty ?? 'Nothing to print yet')); return; }
      row = pick;
    }
    setModal({ spec, row });
  };
  // `?action=<modal id>` opens that modal on arrival — how the shell's primary action (design.sidebar.action) lands here.
  const [params, setParams] = useSearchParams();
  // Next's search params are read-only: edit a mutable copy, never the object itself (deleting on it throws and unmounts the page).
  useEffect(() => { const id = params.get('action'); if (!id) return; const spec = (config.modals ?? []).find((m) => m.id === id); if (spec) setModal({ spec, row: null }); const q = new URLSearchParams(params.toString()); q.delete('action'); setParams(q, { replace: true }); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  // `?where=<clause>&label=…&entity=…` — a number clicked elsewhere (the overview's tiles, UI 7) lands here already narrowed, exactly as a clicked strip item would.
  const [fromLink, setFromLink] = useState(null);
  useEffect(() => { const w = params.get('where'); if (!w) return; const k = { label: params.get('label') ?? 'Filtered', filter: w, entity: params.get('entity') ?? config.entity }; setKpi(k); setFromLink(k); const q = new URLSearchParams(params.toString()); ['where', 'label', 'entity'].forEach((x) => q.delete(x)); setParams(q, { replace: true }); }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  // Header actions may be declared on the page or on any block (a table's `actions.header`): both land in the page header.
  const walk = (bs) => (bs ?? []).flatMap((b) => [...(b.actions?.header ?? []), ...walk(b.blocks), ...(b.tabs ?? []).flatMap((t) => walk(t.blocks))]);
  const headerActions = [...new Set([...(config.actions?.header ?? []), ...walk(config.blocks)])].map((id) => (config.modals ?? []).find((m) => m.id === id)).filter(Boolean);
  const detailRoute = config.detail?.route;

  // A KPI row above a list is a strip (one line, every item a filter); on a page without a list it is tiles.
  const hasList = [...walkAll(config.blocks)].some((b) => ['table', 'queue', 'needs_action', 'calendar', 'approvals'].includes(b.type));
  const renderBlocks = (blocks, scopedRows = rows) => (blocks ?? []).map((b, i) => {
    const key = b.id ?? `${b.type}-${i}`;
    const scoped = b.entity && b.entity !== config.entity ? (data[b.entity] ?? []) : scopedRows;
    switch (b.type) {
      case 'kpis': return <Kpis key={key} kpis={b.kpis.map((k) => ({ entity: config.entity, ...k }))} data={{ ...data, [config.entity]: scopedRows }} loading={busy} user={user} selected={kpi?.label ?? null} onSelect={setKpi} layout={b.layout ?? (hasList ? 'strip' : 'tiles')} />;
      case 'charts': return <Charts key={key} charts={b.charts.map((c) => ({ entity: config.entity, ...c }))} data={{ ...data, [config.entity]: scopedRows }} loading={busy} user={user} />;
      case 'table': return <TableBlock key={key} block={b} page={config} rows={scoped} loading={busy} data={data} openModal={openModal} detailRoute={detailRoute} user={user} reload={reload} extraWhere={kpi && (!kpi.entity || kpi.entity === (b.entity ?? config.entity)) ? kpi.filter : undefined}
        onShown={pdfExport && (b.entity ?? config.entity) === config.entity ? (r, f) => setShown({ rows: r, filters: f, block: b }) : undefined} />;
      case 'tabs': return <Tabs key={key} block={b} rows={scopedRows} renderBlocks={renderBlocks} user={user} />;
      case 'calendar': return <Calendar key={key} block={b} rows={scoped} onOpen={(r) => setDrawerRow(r)} user={user} />;
      case 'stepper': return <Stepper key={key} block={b} data={data} reload={reload} entity={config.entity} />;
      case 'approvals': return <Approvals key={key} block={b} data={data} reload={reload} user={user} />;
      case 'action_card': return <ActionCard key={key} block={b} data={data} reload={reload} user={user} />;
      case 'feed': return <Feed key={key} block={b} data={data} user={user} />;
      case 'queue': case 'needs_action': return <Queue key={key} block={{ ...b, detail_route: b.detail_route ?? detailRoute }} page={config} data={data} user={user} openModal={openModal} reload={reload} />;
      case 'form': return <Form key={key} block={b} data={data} entity={config.entity} />;
      case 'callout': return <Callout key={key} tone={b.tone ?? 'info'} label={b.title}>{b.text}</Callout>;
      case 'custom': { const C = CUSTOM[b.name]; return C ? <C key={key} data={data} rows={scopedRows} reload={reload} openModal={(id, row) => openModal((config.modals ?? []).find((m) => m.id === id), row)} /> : <div key={key} data-custom-stub={b.name} className="rounded-xl border border-dashed border-warn/40 bg-warn-soft p-5 text-sm text-warn-text">Custom section <b>{b.name}</b> pending (step 4).</div>; }
      case 'row': return <div key={key} className={`grid grid-cols-1 lg:grid-cols-${Math.min(b.blocks.length, 3)} gap-4 items-start`}>{renderBlocks(b.blocks, scopedRows)}</div>;
      default: return null;
    }
  });

  const mainAction = Math.max(0, headerActions.findIndex((m) => m.primary));
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="block-gap">
      {fromLink && kpi && kpi.label === fromLink.label && (
        <div className="flex items-center gap-2 text-[13px]" data-os-kpi-filter-chip>
          <span className="text-ink-3">{t('Showing')}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50/70 px-3 h-8 font-medium text-ink">{t(fromLink.label)}
            <Tooltip title={t('Clear filter')}><button type="button" aria-label={`${t('Clear filter')} ${fromLink.label}`} className="no-pill ml-1 w-5 h-5 rounded-full hover:bg-black/[0.06] flex items-center justify-center text-ink-3" onClick={() => { setKpi(null); setFromLink(null); }}>×</button></Tooltip></span>
        </div>
      )}
      {(config.entity || headerActions.length > 0) && (
        <motion.div variants={containerVariants} initial="initial" animate="animate" className="flex items-center justify-end gap-3 flex-wrap">
          <motion.div variants={itemVariants} className="flex gap-2 ml-auto" data-os-page-actions>
            {config.entity && config.export !== false && <Button icon={<Download className="w-4 h-4" />} data-os-export={pdfExport ? 'pdf' : 'csv'} onClick={() => { if (pdfExport) { setListPdf(true); return; } downloadCSV(rows, config.entity); toast.success(t('Export completed')); }}>{t('Export')}</Button>}
            {/* One primary per header (ux-laws: Von Restorff, Fitts) — the action marked `primary`, else the first; it sits last, nearest the pointer's usual path */}
            {headerActions.map((m, i) => ({ m, main: i === mainAction })).sort((a, b) => a.main - b.main).map(({ m, main }) => <Button key={m.id} data-os-action={m.id} type={main ? 'primary' : 'default'} icon={m.kind === 'document' ? <Download className="w-4 h-4" /> : <Plus className="w-4 h-4" />} onClick={() => openModal(m, null)}>{t(m.title)}</Button>)}
          </motion.div>
        </motion.div>
      )}
      {renderBlocks(config.blocks)}
      {pdfExport && listPdf && <ListPdf open onClose={() => setListPdf(false)} spec={pdfExport} page={config} entity={config.entity}
        block={shown?.block ?? [...walkAll(config.blocks)].find((b) => b.type === 'table' && (b.entity ?? config.entity) === config.entity)} rows={shown?.rows ?? rows} filters={shown?.filters ?? {}} />}
      {modal && modal.spec.kind === 'document' && <DocumentPreview docId={modal.spec.document} row={modal.row} data={data} open onClose={() => setModal(null)} />}
      {modal && modal.spec.kind !== 'document' && <ActionModal spec={{ entity: config.entity, ...modal.spec }} row={modal.row} open onClose={() => setModal(null)} data={data} onDone={reload} />}
      {config.entity && <Drawer open={!!drawerRow} onClose={() => setDrawerRow(null)} row={drawerRow} entity={config.entity} spec={config.drawer ?? {}} data={data} actions={(config.actions?.row ?? []).map((id) => (config.modals ?? []).find((m) => m.id === id)).filter(Boolean)} onAction={(m, r) => { setDrawerRow(null); openModal(m, r); }} reload={reload} />}
    </motion.div>
  );
}
