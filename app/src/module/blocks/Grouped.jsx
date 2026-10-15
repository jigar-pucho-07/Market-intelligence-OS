// Grouped — the same rows as the table, sectioned under one coloured header per group value:
// "West Region · 5 states", then the rows. For reference data that people scan by bucket (states
// under regions, price lines under series, users under role) this is faster than a flat table with a
// Region column, because the eye finds the bucket first and reads only its rows.
//   group: { by: Region, order: [West, South, North, East], count: states, collapsible: true,
//            summary: [ { label: RMs, distinct: Regional_Manager } ] }
// Each group's colour comes from the categorical series scale (fixed order, never cycled) unless the
// value is a status, in which case it takes the status colour — the same rule the charts use.
import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { seriesColors } from '../Charts';
import { cn } from '../../utils/cn';

export default function Grouped({ rows, group, columns, onOpen }) {
  const [closed, setClosed] = useState({});
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of rows) { const k = r[group.by] || '—'; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    const order = group.order ?? [...m.keys()].sort();
    const keys = [...order.filter((k) => m.has(k)), ...[...m.keys()].filter((k) => !order.includes(k))];
    const colors = seriesColors(keys);
    return keys.map((k, i) => ({ key: k, rows: m.get(k), color: colors[i] }));
  }, [rows, group]);
  const cols = useMemo(() => columns.filter((c) => c.accessorKey !== group.by), [columns, group.by]);
  const noun = (n) => (group.count ? `${n} ${n === 1 ? group.count.replace(/s$/, '') : group.count}` : `${n} ${n === 1 ? 'row' : 'rows'}`);
  return (
    <div className="divide-y divide-black/[0.05]" data-os-grouped data-os-groups={groups.length}>
      {groups.map((g) => {
        const open = !closed[g.key];
        return (
          <section key={g.key} data-os-group={g.key} data-os-group-count={g.rows.length}>
            <button type="button" onClick={() => group.collapsible !== false && setClosed({ ...closed, [g.key]: open })}
              className={cn('no-pill w-full flex items-center gap-3 px-5 py-3 text-left', group.collapsible !== false && 'hover:bg-black/[0.02] transition-colors')}
              style={{ background: `color-mix(in srgb, ${g.color} 7%, var(--surface))` }} aria-expanded={open}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
              <span className="text-[14px] font-semibold text-ink">{group.label ? group.label.replace('{v}', g.key) : g.key}</span>
              <span className="badge badge-neutral">{noun(g.rows.length)}</span>
              {(group.summary ?? []).map((sm) => {
                const v = sm.distinct ? new Set(g.rows.map((r) => r[sm.distinct]).filter(Boolean)).size : sm.sum ? g.rows.reduce((a, r) => a + (parseFloat(r[sm.sum]) || 0), 0) : '';
                return <span key={sm.label} className="text-[12px] text-ink-3 hidden sm:inline">{sm.label}: <span className="font-medium text-ink-2 tabular">{sm.distinct && sm.names ? [...new Set(g.rows.map((r) => r[sm.distinct]).filter(Boolean))].join(', ') : v}</span></span>;
              })}
              {group.collapsible !== false && <ChevronDown className={cn('w-4 h-4 text-ink-4 ml-auto transition-transform', !open && '-rotate-90')} />}
            </button>
            {open && <DataTable data={g.rows} columns={cols} pager={false} onRowClick={onOpen} />}
          </section>
        );
      })}
    </div>
  );
}
