// OverviewPage — the manager's first screen (audit H4): what needs action, then the numbers, then the charts that
// answer a question, then the latest records. From os.yaml `pages[overview]`: `kpis` (metrics), `queues` (the
// Needs-action panel — each row has an inline action), `charts`, `recent`, `modals`. Quick links are off unless
// `quick_links: true`; the sidebar already lists the pages.
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation } from '../lib/router';
import { ArrowRight } from 'lucide-react';
import { Segmented } from 'antd';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../config/roles';
import { NAV, portalFor } from '../config/nav';
import { ENTITIES, DOCUMENTS } from '../config/os.config';
import Kpis, { pageVariants, containerVariants, itemVariants, icon } from './Kpis';
import Charts, { CARD, SECTION_TITLE } from './Charts';
import Queue from './blocks/Queue';
import ActionModal from './ActionModal';
import DocumentPreview from './DocumentPreview';
import { renderCell } from './cells';
import { modalEntities } from './Fields';
import { useEntities } from '../hooks/useEntity';
import { where, toDate } from './formula';
import { ListSkeleton } from '../components/Skeleton';

const PERIODS = { '1W': 7, '1M': 30, '3M': 90 };

export default function OverviewPage({ config }) {
  const { user } = useAuth();
  const ents = useMemo(() => [...new Set([...(config.kpis ?? []).map((k) => k.entity), ...(config.charts ?? []).map((c) => c.entity), ...(config.queues ?? []).map((q) => q.entity), config.recent?.entity, 'activities', ...(config.modals ?? []).flatMap((m) => modalEntities(m, DOCUMENTS))].filter(Boolean))], [config]);
  const { data, loading, reload } = useEntities(ents);
  const [period, setPeriod] = useState('1M');
  const [modal, setModal] = useState(null);
  const openModal = (spec, row) => setModal({ spec, row });
  const charts = useMemo(() => (config.charts ?? []).map((c) => (c.type === 'trend' ? { ...c, days: c.bucket === 'week' ? Math.max(PERIODS[period], 28) : PERIODS[period] } : c)), [config, period]);
  const perms = ROLE_PERMISSIONS[user?.role] ?? [];
  const { pathname } = useLocation(); const portal = portalFor(pathname);
  const links = NAV.filter((n) => n.portal === portal.id && n.kind !== 'overview' && n.kind !== 'settings' && !n.hidden && (perms.includes('*') || perms.includes(n.id)));
  const recent = useMemo(() => {
    if (!config.recent) return [];
    const rows = where(data[config.recent.entity] ?? [], config.recent.where, user);
    const dc = config.recent.date ?? ENTITIES[config.recent.entity]?.created;
    return [...rows].sort((a, b) => (toDate(b[dc])?.getTime() ?? 0) - (toDate(a[dc])?.getTime() ?? 0)).slice(0, config.recent.limit ?? 8);
  }, [data, config.recent, user]);
  const recentEnt = config.recent ? ENTITIES[config.recent.entity] : null;
  const page = { ...config, modals: config.modals ?? [] };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-5" data-os-overview>
      <motion.div variants={containerVariants} initial="initial" animate="animate" className="flex items-center justify-between flex-wrap gap-3">
        <motion.div variants={itemVariants}><p className="text-[14px] text-ink-2">Welcome back, <span className="font-semibold text-ink">{user?.name}</span>. {config.greeting ?? ''}</p></motion.div>
        {charts.some((c) => c.type === 'trend') && <motion.div variants={itemVariants}><Segmented options={Object.keys(PERIODS)} value={period} onChange={setPeriod} aria-label="Trend period" /></motion.div>}
      </motion.div>
      {config.queues?.length > 0 && <Queue block={{ type: 'needs_action', id: 'needs-action', groups: config.queues, title: config.queues_title ?? 'Needs action', limit: config.queues_limit ?? 3, empty: config.queues_empty }} page={page} data={data} user={user} openModal={openModal} reload={reload} />}
      <Kpis kpis={config.kpis} data={data} loading={loading} user={user} layout={config.kpi_layout ?? 'strip'} />
      <Charts charts={charts} data={data} loading={loading} user={user} />
      <div className={`grid grid-cols-1 ${config.quick_links ? 'lg:grid-cols-3' : ''} gap-5`}>
        {config.recent && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${config.quick_links ? 'lg:col-span-2' : ''} ${CARD}`}>
            <div className="p-4 border-b border-surface-border flex items-center justify-between"><h3 className={SECTION_TITLE}>{config.recent.title ?? 'Recent'}</h3>{config.recent.link && <Link to={config.recent.link} className="text-[12px] font-medium text-primary-600 flex items-center gap-1 min-h-8 hover:underline">View all <ArrowRight className="w-3 h-3" /></Link>}</div>
            {loading ? <div className="p-4"><ListSkeleton items={5} /></div> : (
              <div className="divide-y divide-surface-border">
                {recent.map((r, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-4 hover:bg-black/[0.015] transition-colors">
                    {(config.recent.columns ?? []).map((c) => (typeof c === 'string' ? { key: c } : c)).map((c) => <div key={c.key} className={c.grow ? 'flex-1 min-w-0' : 'shrink-0'}>{renderCell(c, r[c.key], r, { detailRoute: config.recent.detailRoute, ent: recentEnt })}</div>)}
                  </div>
                ))}
                {!recent.length && <p className="p-6 text-[13px] text-ink-3">Nothing yet.</p>}
              </div>
            )}
          </motion.div>
        )}
        {config.quick_links && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} p-5`}>
            <h3 className={`${SECTION_TITLE} mb-3`}>Quick links</h3>
            <div className="space-y-1">
              {links.map((n) => { const I = icon(n.icon); return (
                <Link key={n.id} to={n.path} className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-8)] hover:bg-black/[0.03] transition-colors group">
                  <div className="w-8 h-8 rounded-[var(--r-8)] bg-surface-2 flex items-center justify-center"><I className="w-4 h-4 text-ink-2" /></div>
                  <div className="min-w-0 flex-1"><p className="text-[13px] font-medium text-ink">{n.label}</p><p className="text-[12px] text-ink-3 truncate">{n.subtitle ?? n.desc}</p></div>
                  <ArrowRight className="w-4 h-4 text-ink-4 group-hover:text-ink-2 transition-all" />
                </Link>); })}
            </div>
          </motion.div>
        )}
      </div>
      {modal && modal.spec.kind === 'document' && <DocumentPreview docId={modal.spec.document} row={modal.row} data={data} open onClose={() => setModal(null)} />}
      {modal && modal.spec.kind !== 'document' && <ActionModal spec={modal.spec} row={modal.row} open onClose={() => setModal(null)} data={data} onDone={reload} />}
    </motion.div>
  );
}
