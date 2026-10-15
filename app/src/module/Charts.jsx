import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, Legend } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { toDate, where, toNum } from './formula';
import { ChartSkeleton } from '../components/Skeleton';
import { toneOf } from '../components/ui/primitives';
import { ENTITIES } from '../config/os.config';
import { stageHex } from './stage';

// The card class. Same values as `.card` in index.css — kept as a string so blocks can compose it
// with layout utilities. Change both together.
export const CARD = 'relative overflow-hidden rounded-xl bg-surface border border-[color:var(--hair-5)] shadow-[var(--card-shadow)]';
export const SECTION_TITLE = 'section-title';

// Categorical slots in FIXED order, never cycled. The values are the --cat-* tokens generated per client in
// config/tokens.css (the graphite or the pastel set, by design.tone); SVG accepts var() in fill/stroke.
// Anything using a low-contrast slot ships a legend or direct labels — colour never carries identity alone.
const SERIES_COLORS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `var(--cat-${i})`);
const OTHER = 'var(--cat-other)';              // a 9th series folds into Other, never a new hue
// When a series is a status (Done / Pending / Overdue) its colour is the status colour, so the chart
// agrees with the badges beside it. Anything else takes the next categorical slot.
const STATUS_HEX = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)' };
export function seriesColor(name, i) { const s = stageHex(name); if (s) return s; const t = toneOf(name); return (t === 'ok' || t === 'warn' || t === 'bad') ? STATUS_HEX[t] : (SERIES_COLORS[i] ?? OTHER); }
// A set of series: status colours where they carry meaning (won / behind / lost), categorical slots for the
// rest — and never the same hex twice, so "New / Contacted / Quoted" cannot collapse into one blue.
export function seriesColors(names) {
  const used = new Set(); let slot = 0;
  return names.map((n) => {
    const t = toneOf(n); let c = stageHex(n) ?? ((t === 'ok' || t === 'warn' || t === 'bad') ? STATUS_HEX[t] : null);
    if (!c || used.has(c)) { while (used.has(SERIES_COLORS[slot]) && slot < SERIES_COLORS.length) slot++; c = SERIES_COLORS[slot] ?? OTHER; slot++; }
    used.add(c); return c;
  });
}

// One measure across categories is ONE colour. Painting each bar a different hue makes colour
// follow rank instead of identity — the bars already encode magnitude by height, so the rainbow
// adds nothing and reads as decoration.
const ONE_MEASURE = 'var(--chart-1)';

const AXIS = { fontSize: 12, fill: 'var(--ink-3)', fontFamily: 'inherit' };
const GRID = 'var(--line)';
// Tooltip item text is ink (the swatch keeps the series colour): a 12px legend in a pastel series colour fails contrast.
const TOOLTIP_ITEM = { color: 'var(--ink)', fontWeight: 500 };
const TOOLTIP_LABEL = { color: 'var(--ink-2)', marginBottom: 2 };
const TOOLTIP = { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', boxShadow: '0 12px 32px -12px rgba(21,24,28,0.22)', fontSize: 12, color: 'var(--ink)' };

// ---- Axis text: never cut, never overlapping -------------------------------------------------
// Values compact to ₹4.5L / ₹1.2Cr / 12k so the Y axis is four characters wide instead of "2500000"
// truncated to "00000"; the axis width is measured from the longest formatted tick. Category labels
// wrap to two lines when they fit the slot, rotate when they don't, and a one-measure bar chart with
// many long categories turns horizontal so every label is read in full.
const MONEY_COL = /(inr|amount|value|price|revenue|total|cost|_rs)$/i;
export function isMoneyCol(col, chart) { return chart?.format === 'money' || (!!col && MONEY_COL.test(String(col))); }
export function compact(v, money) {
  const n = Number(v) || 0; const a = Math.abs(n); const sign = n < 0 ? '-' : ''; const p = money ? '₹' : '';
  const f = (x, d) => (x >= 100 ? x.toFixed(0) : x.toFixed(d).replace(/\.0$/, ''));
  if (money && a >= 1e7) return `${sign}${p}${f(a / 1e7, 1)}Cr`;
  if (money && a >= 1e5) return `${sign}${p}${f(a / 1e5, 1)}L`;
  if (a >= 1e6) return `${sign}${p}${f(a / 1e6, 1)}M`;
  if (a >= 1e3) return `${sign}${p}${f(a / 1e3, 1)}k`;
  return `${sign}${p}${Number.isInteger(n) ? n : n.toFixed(1)}`;
}
const CH = 7.2;                                       // px per character at 12px
export function axisWidth(max, money) { return Math.max(30, Math.round(compact(max, money).length * CH) + 12); }
export function fullValue(v, money) { return money ? `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : Number(v || 0).toLocaleString('en-IN'); }
function wrapText(text, perLine, maxLines) {
  const words = String(text).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { if ((cur + ' ' + w).trim().length > perLine && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = keep[maxLines - 1].slice(0, Math.max(1, perLine - 1)) + '…'; return keep; }
  return lines;
}
function CategoryTick({ x, y, payload, slot, rotate }) {
  const text = String(payload.value);
  if (rotate) return <text x={x} y={y + 6} textAnchor="end" fontSize={12} fill={AXIS.fill} transform={`rotate(-35 ${x} ${y + 6})`}>{text.length > 18 ? text.slice(0, 17) + '…' : text}</text>;
  const lines = wrapText(text, Math.max(5, Math.floor(slot / CH)), 2);
  return <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fill={AXIS.fill}>{lines.map((l, i) => <tspan key={i} x={x} dy={i ? 12 : 8}>{l}</tspan>)}</text>;
}
function useWidth() {
  const ref = useRef(null); const [w, setW] = useState(0);
  useEffect(() => { const el = ref.current; if (!el) return; const ro = new ResizeObserver(([e]) => setW(e.contentRect.width)); ro.observe(el); setW(el.clientWidth); return () => ro.disconnect(); }, []);
  return [ref, w];
}
/** Decide how category labels are drawn from the slot each gets: wrapped (2 lines), or rotated -35°. */
function categoryAxis(labels, plotWidth) {
  const n = Math.max(labels.length, 1); const slot = plotWidth / n; const longest = Math.max(...labels.map((l) => String(l).length), 1);
  const rotate = slot < 44 || (longest * CH > slot * 2 && slot < 80);
  return { slot, rotate, height: rotate ? 58 : (longest * CH > slot ? 36 : 24) };
}

function LegendRow({ keys, colors }) {
  if (keys.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3" data-os-legend>
      {keys.map((k, i) => <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-ink-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }} />{k}</span>)}
    </div>
  );
}

function TrendChart({ chart, rows, user }) {
  const days = chart.days ?? 14;
  const data = useMemo(() => {
    const src = where(rows, chart.where, user);
    const dates = src.map((r) => toDate(r[chart.date])).filter(Boolean);
    const anchor = dates.length ? new Date(Math.max(...dates)) : new Date();
    // `bucket: week` groups by week (a source chart at a one-month zoom is empty per day, readable per week — M8)
    const weekly = chart.bucket === 'week'; const n = weekly ? Math.max(4, Math.ceil(days / 7)) : days;
    const buckets = Array.from({ length: n }, (_, i) => startOfDay(subDays(anchor, (n - 1 - i) * (weekly ? 7 : 1))));
    const seriesCol = chart.series?.[0];
    const seriesVals = seriesCol ? [...new Set(src.map((r) => r[seriesCol]).filter(Boolean))].slice(0, 4) : ['Total'];
    return buckets.map((b) => {
      const next = new Date(b.getTime() + 864e5 * (weekly ? 7 : 1)); const inDay = src.filter((r) => { const d = toDate(r[chart.date]); return d && d >= b && d < next; });
      const o = { day: weekly ? `wk ${format(b, 'd MMM')}` : days <= 14 ? format(b, 'EEE d') : format(b, 'dd MMM') };
      for (const v of seriesVals) o[v] = seriesCol ? inDay.filter((r) => r[seriesCol] === v).length : (chart.sum ? inDay.reduce((a, r) => a + toNum(r[chart.sum]), 0) : inDay.length);
      return o;
    });
  }, [rows, chart, days, user]);
  const keys = Object.keys(data[0] ?? {}).filter((k) => k !== 'day');
  const colors = keys.length === 1 ? [ONE_MEASURE] : seriesColors(keys);
  const money = isMoneyCol(chart.sum, chart);
  const max = Math.max(chart.target ?? 0, ...data.flatMap((d) => keys.map((k) => d[k] || 0)), 1);
  const [ref, w] = useWidth();
  const skip = w ? Math.max(0, Math.ceil((data.length * 44) / Math.max(w - 48, 1)) - 1) : 0;   // show every (skip+1)th day label
  // Sparse counts (a few records a day) drawn as a smoothed area read as random bumps; stacked bars per day say "one lead on Tuesday".
  const smax = Math.max(chart.target ?? 0, ...data.map((d) => keys.reduce((t, k) => t + (d[k] || 0), 0)), 1);   // stacked height per day
  const sparse = chart.style !== 'area' && !chart.sum && smax <= 6;
  if (sparse) return (
    <div ref={ref} data-os-chart-style="bars">
      <LegendRow keys={keys} colors={colors} />
      <ResponsiveContainer width="100%" height={chart.height ?? 240}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval={skip} minTickGap={8} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={axisWidth(smax, false)} domain={[0, Math.max(smax, 2)]} />
          <Tooltip contentStyle={TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: 'var(--hover-wash)' }} />
          {chart.target !== undefined && <ReferenceLine y={chart.target} stroke="var(--ink-4)" strokeDasharray="4 4" label={{ value: chart.target_label ?? `Target ${chart.target}`, position: 'insideTopRight', fontSize: 12, fill: AXIS.fill }} />}
          {keys.map((k, i) => <Bar key={k} dataKey={k} stackId="day" fill={colors[i]} maxBarSize={18} radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0} />)}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
  return (
    <div ref={ref} data-os-chart-style="area">
      <LegendRow keys={keys} colors={colors} />
      <ResponsiveContainer width="100%" height={chart.height ?? 240}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>{keys.map((k, i) => <linearGradient key={k} id={`g-${chart.id}-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors[i]} stopOpacity={0.12} /><stop offset="100%" stopColor={colors[i]} stopOpacity={0} /></linearGradient>)}</defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="day" tick={AXIS} axisLine={false} tickLine={false} interval={skip} minTickGap={8} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={axisWidth(max, money)} tickFormatter={(v) => compact(v, money)} />
          <Tooltip contentStyle={TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} formatter={(v) => fullValue(v, money)} />
          {chart.target !== undefined && <ReferenceLine y={chart.target} stroke="var(--ink-4)" strokeDasharray="4 4" label={{ value: chart.target_label ?? `Target ${chart.target}`, position: 'insideTopRight', fontSize: 11, fill: 'var(--ink-3)' }} />}
          {keys.map((k, i) => <Area key={k} type="monotone" dataKey={k} stroke={colors[i]} strokeWidth={2} fill={`url(#g-${chart.id}-${i})`} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// Breakdown: one measure per group (a bar or a donut). With `series: <Column>` each group splits into
// grouped bars — "Done / Pending / Overdue per department" — coloured by status when the values are
// statuses, so the chart and the badges agree.
function BreakdownChart({ chart, rows, user }) {
  const { data, keys } = useMemo(() => {
    const src = where(rows, chart.where, user); const limit = chart.limit ?? 6;
    const measure = (r) => (chart.sum ? toNum(r[chart.sum]) : 1);
    if (chart.series) {
      const groups = {}; const seriesVals = [];
      for (const r of src) {
        const g = r[chart.group] || '—'; const s = r[chart.series] || '—';
        if (!seriesVals.includes(s)) seriesVals.push(s);
        groups[g] = groups[g] ?? { name: g, _total: 0 }; groups[g][s] = (groups[g][s] || 0) + measure(r); groups[g]._total += measure(r);
      }
      const ordered = chart.series_order ?? seriesVals.slice(0, 6);
      return { data: Object.values(groups).sort((a, b) => b._total - a._total).slice(0, limit), keys: ordered };
    }
    const counts = {}; for (const r of src) { const k = r[chart.group] || '—'; counts[k] = (counts[k] || 0) + measure(r); }
    // A status/stage breakdown keeps the pipeline's own order (a funnel reads top to bottom); anything else ranks by value.
    const st = ENTITIES[chart.entity]?.status; const order = chart.order ?? (st && st.column === chart.group ? st.values : null);
    const list = Object.entries(counts).map(([name, value]) => ({ name, value }));
    const sorted = order ? list.sort((a, b) => (order.indexOf(a.name) === -1 ? 99 : order.indexOf(a.name)) - (order.indexOf(b.name) === -1 ? 99 : order.indexOf(b.name))) : list.sort((a, b) => b.value - a.value);
    return { data: sorted.slice(0, order ? 12 : limit), keys: ['value'] };
  }, [rows, chart, user]);
  const colors = chart.series ? seriesColors(keys) : [ONE_MEASURE];
  const money = isMoneyCol(chart.sum, chart);
  const [ref, w] = useWidth();
  const labels = data.map((d) => d.name);
  const longest = Math.max(...labels.map((l) => String(l).length), 1);
  // One measure with many or long categories → horizontal bars: labels are read in full, in order.
  const horizontal = chart.layout === 'horizontal' || (chart.layout !== 'vertical' && !chart.series && (data.length > 5 || longest > 14));
  const max = Math.max(chart.target ?? 0, ...data.flatMap((d) => keys.map((k) => d[k] || 0)), 1);
  if (chart.style === 'bar' || chart.series) {
    if (horizontal) {
      const maxChars = w ? Math.max(12, Math.min(30, Math.floor((w * 0.38) / CH))) : 24;   // labels take at most ~38% of the card
      const labelW = Math.round(Math.min(longest, maxChars) * CH) + 12;
      const trunc = (v) => (String(v).length > maxChars ? String(v).slice(0, maxChars - 1) + '…' : String(v));
      const h = chart.height ?? Math.max(160, data.length * 34 + 24);
      return (
        <div ref={ref} data-os-chart-layout="horizontal">
          <ResponsiveContainer width="100%" height={h}>
            <BarChart data={data} layout="vertical" barCategoryGap="28%" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} tickFormatter={(v) => compact(v, money)} />
              <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={labelW} interval={0} tick={({ x, y, payload }) => <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={AXIS.fill}><title>{payload.value}</title>{trunc(payload.value)}</text>} />
              <Tooltip contentStyle={TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: 'var(--hover-wash)' }} formatter={(v) => fullValue(v, money)} />
              {chart.target !== undefined && <ReferenceLine x={chart.target} stroke="var(--ink-4)" strokeDasharray="4 4" />}
              {keys.map((k, i) => <Bar key={k} dataKey={k} radius={[0, 4, 4, 0]} fill={colors[i]} maxBarSize={22} label={{ position: 'right', fontSize: 12, fill: AXIS.fill, formatter: (v) => compact(v, money) }} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }
    const yW = axisWidth(max, money);
    const cat = categoryAxis(labels, Math.max((w || 480) - yW - 20, 80));
    return (
      <div ref={ref} data-os-chart-layout="vertical">
        {chart.series && <LegendRow keys={keys} colors={colors} />}
        <ResponsiveContainer width="100%" height={(chart.height ?? 220) + (cat.height - 24)}>
          <BarChart data={data} barCategoryGap={chart.series ? '20%' : '35%'} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} height={cat.height} tick={<CategoryTick slot={cat.slot} rotate={cat.rotate} />} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} width={yW} tickFormatter={(v) => compact(v, money)} />
            <Tooltip contentStyle={TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} cursor={{ fill: 'var(--hover-wash)' }} formatter={(v) => fullValue(v, money)} />
            {chart.target !== undefined && <ReferenceLine y={chart.target} stroke="var(--ink-4)" strokeDasharray="4 4" label={{ value: chart.target_label ?? `Target ${compact(chart.target, money)}`, position: 'insideTopRight', fontSize: 12, fill: AXIS.fill }} />}
            {keys.map((k, i) => <Bar key={k} dataKey={k} radius={[4, 4, 0, 0]} fill={colors[i]} maxBarSize={chart.series ? 22 : 48} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const total = data.reduce((a, d) => a + d.value, 0);
  const pieColors = seriesColors(data.map((d) => d.name));
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="w-full sm:w-1/2"><ResponsiveContainer width="100%" height={chart.height ?? 180}>
        <PieChart><Pie data={data} cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={2} dataKey="value" stroke="none">{data.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}</Pie><Tooltip contentStyle={TOOLTIP} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} itemStyle={TOOLTIP_ITEM} labelStyle={TOOLTIP_LABEL} formatter={(v) => fullValue(v, money)} /></PieChart>
      </ResponsiveContainer></div>
      <ul className="w-full sm:w-1/2 space-y-1.5" data-os-legend>
        {data.map((d, i) => <li key={d.name} className="flex items-center gap-2 text-[12px]"><span className="w-2 h-2 rounded-full shrink-0" style={{ background: pieColors[i] }} /><span className="text-ink-2 truncate flex-1">{d.name}</span><span className="tabular text-ink font-medium">{chart.sum ? fullValue(d.value, money) : d.value}</span>{total > 0 && <span className="tabular text-ink-3 w-9 text-right">{Math.round((d.value / total) * 100)}%</span>}</li>)}
      </ul>
    </div>
  );
}

// Funnel (audit M8): one bar per pipeline stage in the entity's own order, coloured by the stage ramp, with the
// count, the ₹ value (`value: <money column>`) and the step conversion from the previous stage. `stages:` narrows
// or reorders; `where:` scopes the rows. Answers "where do leads stall?" — a donut of 4/4/4/3 never did.
function FunnelChart({ chart, rows, user }) {
  const ent = ENTITIES[chart.entity]; const col = chart.column ?? ent?.status?.column;
  const stages = chart.stages ?? ent?.status?.values ?? [];
  const src = where(rows, chart.where, user);
  // A funnel is cumulative: a lead in Negotiation has also been New, Contacted and Quoted. Each bar counts the records that
  // reached that stage or a later one (`cumulative: false` for a plain "where are they now" breakdown). Stages with no
  // records that mean "left the pipeline" (Lost) are dropped rather than drawn as an empty bar.
  const idx = (s) => stages.indexOf(s);
  const cumulative = chart.cumulative !== false;
  const gone = (s) => /^(lost|rejected|expired|cancelled|canceled|closed|dropped|declined|failed)$/i.test(s);
  const data = stages.map((s, i) => {
    const rs = cumulative ? src.filter((r) => { const j = idx(r[col]); return j >= i && !(gone(r[col]) && !gone(s)); }) : src.filter((r) => r[col] === s);
    return { name: s, count: rs.length, value: chart.value ? rs.reduce((a, r) => a + toNum(r[chart.value]), 0) : null };
  }).filter((d) => !(gone(d.name) && d.count === 0));
  const max = Math.max(1, ...data.map((d) => d.count));
  const [ref] = useWidth();
  return (
    <ol ref={ref} className="space-y-2" data-os-funnel>
      {data.map((d, i) => {
        const prev = i > 0 ? data[i - 1].count : null; const conv = prev ? Math.round((d.count / prev) * 100) : null;
        const hex = stageHex(d.name) ?? SERIES_COLORS[i % SERIES_COLORS.length];
        return (
          <li key={d.name} className="grid grid-cols-[minmax(96px,150px)_1fr_auto] items-center gap-3" data-os-funnel-stage={d.name} data-count={d.count}>
            <span className="text-[12px] text-ink-2 truncate" title={d.name}>{d.name}</span>
            <div className="h-5 rounded-[var(--r-4)] bg-surface-2 overflow-hidden"><div className="h-full rounded-[var(--r-4)]" style={{ width: `${Math.max(2, (d.count / max) * 100)}%`, background: hex }} /></div>
            <span className="text-[12px] tabular whitespace-nowrap text-ink"><span className="font-semibold">{d.count}</span>{d.value !== null && d.value > 0 && <span className="text-ink-3"> · {compact(d.value, true)}</span>}{conv !== null && <span className={conv < 40 ? 'text-bad-text' : 'text-ink-3'}> · {conv}%</span>}</span>
          </li>
        );
      })}
      {chart.footer === undefined && <li className="text-[12px] text-ink-3 pt-1">{cumulative ? 'Reached this stage or beyond · conversion from the previous stage' : 'Count · value · conversion from the previous stage'}</li>}
    </ol>
  );
}

export default function Charts({ charts, data, loading, user }) {
  if (!charts?.length) return null;
  const trend = charts.filter((c) => c.type === 'trend'); const rest = charts.filter((c) => c.type !== 'trend');
  // A six-column grid: a trend takes four (six alone); breakdowns take two, or three each when two share a
  // row, or six alone. `span: 1..6` on a chart overrides.
  const n = charts.length;
  // trend + one breakdown → 4 + 2; trend + two → 6 then 3 + 3 (never a half-empty row); breakdowns alone → 3 + 3 or 2 + 2 + 2.
  const span = (c) => { if (c.span) return `lg:col-span-${Math.min(6, c.span)}`; if (n === 1) return 'lg:col-span-6'; if (c.type === 'trend') return rest.length === 1 ? 'lg:col-span-4' : 'lg:col-span-6'; if (!trend.length) return n === 2 ? 'lg:col-span-3' : 'lg:col-span-2'; return rest.length === 1 ? 'lg:col-span-2' : rest.length === 2 ? 'lg:col-span-3' : 'lg:col-span-2'; };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-6 gap-4" data-os-charts>
      {[...trend, ...rest].map((c) => (
        <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className={`${span(c)} ${CARD} p-5`}>
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h3 className={SECTION_TITLE}>{c.title}</h3>
            {c.caption && <span className="text-[11px] text-ink-3 truncate">{c.caption}</span>}
          </div>
          {loading ? <ChartSkeleton height={c.type === 'trend' ? 220 : 180} /> : c.type === 'trend' ? <TrendChart chart={c} rows={data[c.entity] ?? []} user={user} /> : c.type === 'funnel' ? <FunnelChart chart={c} rows={data[c.entity] ?? []} user={user} /> : <BreakdownChart chart={c} rows={data[c.entity] ?? []} user={user} />}
          {c.footer && <p className="mt-3 pt-3 border-t border-[color:var(--hair-5)] text-[12px] text-ink-3">{c.footer}</p>}
        </motion.div>
      ))}
    </div>
  );
}
