import { useT } from '../i18n';
import { useNarrow } from '../hooks/useNarrow';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import GlassStatCard from '../components/GlassStatCard';
import { StatCardSkeleton } from '../components/Skeleton';
import { evalFormula, formatValue } from './formula';
import { toneOf } from '../components/ui/primitives';
import { cn } from '../utils/cn';
import { PAGES } from '../config/pages';
import { ROLE_PERMISSIONS } from '../config/roles';
import { useNavigate } from '../lib/router';

// Every number opens the list behind it (Haresh review Oct 2026, UI 7). A KPI that narrows nothing on its own page — the
// overview's tiles, a strip with no table for that entity — links to the page that lists its entity, carrying the clause as
// `?where=…&label=…&entity=…`; Page.jsx reads it on arrival and selects it like a clicked strip item (one clause, one filter).
function listPageFor(entity, role) {
  const perms = ROLE_PERMISSIONS[role] ?? []; const can = (p) => perms.includes('*') || perms.includes(p.id);
  const hasTable = (bs) => (bs ?? []).some((b) => b.type === 'table' || hasTable(b.blocks) || (b.tabs ?? []).some((t) => hasTable(t.blocks)));
  return PAGES.find((p) => !p.public && !p.hidden && !['overview', 'settings', 'users', 'system'].includes(p.kind ?? 'page') && p.entity === entity && hasTable(p.blocks) && can(p)) ?? null;
}
export function kpiLink(k, role) {
  if (k.filter === false) return null;   // the author opted this number out of filtering (a date-relative clause the list cannot show as a chip)
  const clause = k.filter ?? (/^(count|sum \w+) where (.+)$/.exec(k.formula ?? '') ?? [])[2];
  if (!clause || !k.entity) return null;
  const pg = listPageFor(k.entity, role); if (!pg) return null;
  return `${pg.route}?where=${encodeURIComponent(clause)}&label=${encodeURIComponent(k.label ?? '')}&entity=${encodeURIComponent(k.entity)}`;
}

// Motion acknowledges a change; it does not perform. A short fade-up, a small stagger, no spring
// and no scale — eight cards bouncing into place reads as a loading screen, not a dashboard.
const EASE = [0.25, 0.1, 0.25, 1];
export const containerVariants = { animate: { transition: { staggerChildren: 0.03 } } };
export const itemVariants = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } } };
export const pageVariants = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } };

export function icon(name) { return Icons[name] || Icons.Circle; }

// A KPI extra is either a literal or a formula over the same entity: `sub: "7 pending"` or
// `sub: { formula: "count where Status=Pending", suffix: " pending today" }`.
function extra(spec, rows, user) {
  if (spec === undefined || spec === null) return undefined;
  if (typeof spec !== 'object') return spec;
  const v = spec.formula ? evalFormula(spec.formula, rows, user) : spec.value;
  return `${spec.prefix ?? ''}${formatValue(v, spec.format)}${spec.suffix ?? ''}`;
}
function num(spec, rows, user) { return typeof spec === 'object' && spec?.formula ? evalFormula(spec.formula, rows, user) : Number(spec); }

export function kpiValue(k, data, user) {
  const rows = data[k.entity] ?? [];
  return evalFormula(k.formula, rows, user);
}

// The strip (audit M1): one 64px row above a list, every item a filter, the list starts above the fold.
// Tiles stay for the overview, where the numbers are the page.
function Strip({ kpis, data, loading, user, selected, onSelect }) {
  const t = useT(); const navigate = useNavigate();
  return (
    <div className="card flex items-stretch overflow-x-auto scrollbar-hide divide-x divide-surface-border" data-os-kpis data-os-kpi-layout="strip">
      {kpis.map((k) => {
        const rows = data[k.entity] ?? []; const raw = loading ? null : evalFormula(k.formula, rows, user);
        const semantic = k.tone === 'auto' ? toneOf(k.label) : (k.tone ?? 'neutral');
        const live = raw !== null && Number(raw) !== 0 && (semantic === 'bad' || semantic === 'warn' || semantic === 'ok');
        const on = selected !== undefined && selected === k.label; const link = onSelect && k.filter ? null : kpiLink(k, user?.role); const click = (onSelect && k.filter) || !!link;
        return (
          <button key={k.label} type="button" disabled={!click} aria-pressed={onSelect && k.filter ? (on ? 'true' : 'false') : undefined} data-os-metric={k.metric} data-os-kpi-label={t(k.label)} data-kpi-value={raw ?? ''} data-os-kpi-link={link ?? undefined} title={link ? `Open ${t(k.label)}` : undefined}
            onClick={link ? () => navigate(link) : click ? () => onSelect(on ? null : k) : undefined}
            className={cn('no-pill flex flex-col justify-center min-w-[128px] flex-1 px-4 h-16 text-left transition-colors', click && 'hover:bg-black/[0.02] cursor-pointer', !click && 'cursor-default', on && 'bg-primary-50/70 shadow-[inset_0_-2px_0_var(--primary)]')}>
            <span className="text-[12px] font-medium text-ink-3 truncate">{t(k.label)}</span>
            <span className={cn('text-[20px] font-semibold tabular leading-tight truncate', live ? { bad: 'text-bad-text', warn: 'text-warn-text', ok: 'text-ok-text' }[semantic] : 'text-ink')}>{loading ? '…' : formatValue(raw, k.format === 'money' && raw >= 100000 ? 'money_l' : k.format)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function Kpis({ kpis, data, loading, user, selected, onSelect, layout = 'tiles' }) {
  const narrowVp = useNarrow();
  const t = useT(); const navigate = useNavigate();
  if (layout === 'strip') return <Strip kpis={kpis} data={data} loading={loading} user={user} selected={selected} onSelect={onSelect} />;
  const cols = Math.min(kpis.length, 6);
  return (
    <motion.div variants={containerVariants} initial="initial" animate="animate" className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${cols} gap-3`} data-os-kpis>
      {loading ? kpis.map((_, i) => <motion.div key={i} variants={itemVariants}><StatCardSkeleton /></motion.div>) : kpis.map((k) => {
        const rows = data[k.entity] ?? [];
        const raw = evalFormula(k.formula, rows, user);
        const narrowMoney = k.format === 'money' && raw >= 100000 && narrowVp;
        const progress = k.progress ? { value: num(k.progress.value ?? k.formula, rows, user), of: num(k.progress.of, rows, user), tone: k.progress.tone } : undefined;
        return (
          <motion.div key={k.label} variants={itemVariants}>
            <GlassStatCard
              icon={icon(k.icon)} label={t(k.label)} value={formatValue(raw, narrowMoney ? 'money_l' : k.format)}
              alert={k.alert && raw > 0} subtitle={extra(k.sub ?? k.subtitle, rows, user)} tone={k.tone} progress={progress} metric={k.metric}
              selected={selected !== undefined && selected === k.label}
              link={onSelect && k.filter ? null : kpiLink(k, user?.role)}
              onClick={onSelect && k.filter ? () => onSelect(selected === k.label ? null : k) : (kpiLink(k, user?.role) ? () => navigate(kpiLink(k, user?.role)) : undefined)}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
