// Toolbar — the ONE search + filters row every table uses. Same height (CONTROL_HEIGHT), same gap, same order on every page:
// [search (fills, max 360px)] [filter] [filter] … [period chips] [view toggle] [count, right-aligned].
// Wraps cleanly on mobile: search full width, filters in a row. Chips and the toggle are not `.os-control`, so the
// gate's height/centre checks apply to the fields only.
import { selectProps } from '../config/popup';
import { Input, Select } from 'antd';
import { Search, X } from 'lucide-react';
import { Chip } from '../components/ui/primitives';
import { where } from './formula';
import { useT } from '../i18n';
import { humanize, labelOf } from '../utils/labels';
import { Tooltip } from 'antd';

export const PERIODS = { today: 'Today', yesterday: 'Yesterday', '7d': '7 days', '30d': '30 days', month: 'This month', all: 'All' };

export default function Toolbar({ label, q, setQ, filters = [], rows = [], active, setActive, count, period, periodValue, setPeriod, right, data }) {
  const t = useT();
  // A filter is a column name, or `{ column, label, options_from: team_members.Name, where: "Role=Sales Rep" }` —
  // the manager's "Rep" switcher on a shared page (audit H3) is just a filter with a label and a people list.
  const specs = filters.map((f) => (typeof f === 'string' ? { column: f } : f));
  const optionsOf = (f) => { if (f.options_from) { const [e, c] = f.options_from.split('.'); let rs = data?.[e] ?? []; if (f.where) rs = where(rs, f.where); return [...new Set(rs.map((r) => r[c]).filter(Boolean))].map((v) => ({ value: v, label: v })); } return [...new Set(rows.map((r) => r[f.column]).filter(Boolean))].sort().map((v) => ({ value: v, label: v })); };
  return (
    <div className="os-toolbar flex flex-wrap items-center gap-3 p-4 border-b border-[color:var(--hair-5)]" data-os-toolbar>
      <Input
        allowClear={{ clearIcon: <Tooltip title={t('Clear search')}><X className="w-3.5 h-3.5" aria-label={t('Clear search')} role="img" /></Tooltip> }}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`${t('Search')} ${String(t(label)).toLowerCase()}…`}
        prefix={<Search className="w-4 h-4 text-ink-4" aria-hidden />}
        className="os-control w-full sm:w-auto sm:flex-1 sm:min-w-[140px] sm:max-w-[360px]"
        aria-label={`${t('Search')} ${t(label)}`}
      />
      {specs.map((f) => (
        <Select
          {...selectProps}
          key={f.column}
          allowClear
          value={active[f.column] || undefined}
          placeholder={labelOf(t, f.column, f.label)}
          options={optionsOf(f)}
          onChange={(v) => setActive({ ...active, [f.column]: v })}
          className="os-control os-filter"
          popupMatchSelectWidth={false}
          data-os-filter={f.column}
          aria-label={`${t('Filter by')} ${labelOf(t, f.column, f.label)}`}
        />
      ))}
      {period && (
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide max-w-full" data-os-period>
          {(period.presets ?? ['today', 'yesterday', '7d', 'all']).map((p) => <Chip key={p} label={t(PERIODS[p] ?? p)} pressed={periodValue === p} onClick={() => setPeriod(p)} />)}
        </div>
      )}
      <span className="ml-auto flex items-center gap-3">
        {right}
        <span data-os-count={count} className="text-[13px] text-ink-3 whitespace-nowrap tabular">{count} {t(count === 1 ? 'record' : 'records')}</span>
      </span>
    </div>
  );
}
