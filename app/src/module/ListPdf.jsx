// ListPdf — a page's Export as a designed PDF (os.yaml page `export: { format: pdf, ... }`, 24 Oct 2026). It lays out the rows the
// table is showing (its period, status chip and search already applied): a letterhead in the brand colour, the filter line and the
// time it was generated, summary tiles (total, one per status, the sum of every number column), then the table with the block's own
// columns — dates formatted, badge columns as coloured pills, `sub:` values as a second line. Print / Save PDF prints the MAIN window
// (a copy of the sheet as a direct child of <body>, a print-only stylesheet hides the rest) — a hidden-iframe print is ignored by
// some browsers. Everything is inline-styled so the printed page looks the same in light and dark mode.
import { useMemo, useRef } from 'react';
import { Button } from 'antd';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import Modal from '../components/Modal';
import { toneOf } from '../components/ui/primitives';
import { ENTITIES, OS, BRAND } from '../config/os.config';
import { toDate, toNum } from './formula';

const TONE = { ok: ['#E7F6EF', '#0B6B4F'], warn: ['#FEF3E2', '#92590A'], bad: ['#FDECEC', '#B42318'], info: ['#E8F1FD', '#1D4ED8'], neutral: ['#F1F3F5', '#4B5563'], brand: ['#E7F6EF', '#0B6B4F'] };
// Market words first (BULLISH is not a status word), then the kernel's status vocabulary.
const toneFor = (v) => { const s = String(v ?? ''); if (/bear|negative|sell/i.test(s)) return 'bad'; if (/bull|positive/i.test(s)) return 'ok'; if (/cautious|neutral|range|volatile|watch/i.test(s)) return 'warn'; return toneOf(s); };
const humanize = (k) => String(k ?? '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const PERIOD = { today: 'Today', yesterday: 'Yesterday', '7d': 'Last 7 days', '30d': 'Last 30 days', month: 'This month', all: 'All time' };
const fill = (tpl, vars) => String(tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

function text(col, v) {
  if (v === '' || v == null) return '—';
  if (col.type === 'date') { const d = toDate(v); return d ? format(d, col.time ? 'dd MMM yyyy, hh:mm a' : 'dd MMM yyyy') : String(v); }
  if (col.type === 'number') return Number.isFinite(toNum(v)) ? toNum(v).toLocaleString('en-IN') : String(v);
  if (col.type === 'money') return `₹${toNum(v).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return String(v);
}

export default function ListPdf({ open, onClose, spec = {}, page, entity, block, rows = [], filters = {} }) {
  const ref = useRef(null);
  const ent = ENTITIES[entity];
  const cols = useMemo(() => (block?.columns ?? ent?.columns?.slice(0, 6).map((k) => ({ key: k })) ?? []).map((c) => (typeof c === 'string' ? { key: c } : c)), [block, ent]);
  const now = new Date();
  const title = spec.title ?? page?.label ?? humanize(entity);
  const filterLine = [filters.period && PERIOD[filters.period], filters.segment && `${humanize(block?.segments?.column ?? ent?.status?.column)}: ${filters.segment}`, filters.q && `Search “${filters.q}”`].filter(Boolean).join(' · ') || 'All records';
  const statusCol = ent?.status?.column;
  const tiles = useMemo(() => {
    const t = [{ label: 'Records', value: rows.length, tone: 'brand' }];
    if (statusCol) for (const s of ent.status.values) { const n = rows.filter((r) => r[statusCol] === s).length; if (n) t.push({ label: s, value: n, tone: toneFor(s) }); }
    for (const c of cols.filter((x) => x.type === 'number')) t.push({ label: `${c.header ?? humanize(c.key)} (total)`, value: rows.reduce((a, r) => a + (toNum(r[c.key]) || 0), 0).toLocaleString('en-IN'), tone: 'neutral' });
    return t;
  }, [rows, cols, statusCol, ent]);
  const name = fill(spec.file_name ?? `${OS.name} — ${title}`, { today: format(now, 'yyyy-MM-dd') });

  const print = () => {
    document.getElementById('os-print-root')?.remove(); document.getElementById('os-print-style')?.remove();
    const st = document.createElement('style'); st.id = 'os-print-style';
    st.textContent = `@media screen{#os-print-root{display:none!important}}
      @media print{@page{size:A4 ${spec.orientation === 'portrait' ? 'portrait' : 'landscape'};margin:12mm}
      html,body{background:#fff!important;height:auto!important;overflow:visible!important}
      body>*:not(#os-print-root){display:none!important}
      #os-print-root{display:block!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      #os-print-root thead{display:table-header-group} #os-print-root tr{break-inside:avoid}}`;
    const root = document.createElement('div'); root.id = 'os-print-root'; root.innerHTML = ref.current.innerHTML;
    document.head.appendChild(st); document.body.appendChild(root);
    const pageTitle = document.title; document.title = name;
    let done = false;
    const cleanup = () => { if (done) return; done = true; document.title = pageTitle; root.remove(); st.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(cleanup, 10 * 60 * 1000);
  };

  const C = BRAND.color;
  const pill = (v) => { const [bg, fg] = TONE[toneFor(v)] ?? TONE.neutral; return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, background: bg, color: fg, fontWeight: 700, fontSize: 10, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{String(v)}</span>; };
  const sheet = (
    <div style={{ fontFamily: 'Lato, Arial, sans-serif', color: '#1F2937', fontSize: 11, background: '#fff' }}>
      <div style={{ height: 6, background: C, borderRadius: 3, marginBottom: 14 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-.01em' }}>{spec.letterhead ?? OS.name}</div>
          {(spec.lines ?? [OS.client.split('—')[1]?.trim() ?? '']).filter(Boolean).map((l, i) => <div key={i} style={{ color: '#6B7280', fontSize: 11, marginTop: 2 }}>{l}</div>)}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C, textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{filterLine}</div>
          <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>Generated {format(now, 'dd MMM yyyy, hh:mm a')}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {tiles.map((t) => { const [bg, fg] = TONE[t.tone] ?? TONE.neutral; return (
          <div key={t.label} style={{ flex: '1 1 110px', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 12px', background: '#FAFAFA' }}>
            <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: fg, marginTop: 2 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: bg, border: `2px solid ${fg}`, marginRight: 6, verticalAlign: 'middle' }} />{t.value}</div>
          </div>); })}
      </div>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11, border: '1px solid #E5E7EB', borderRadius: 10, overflow: 'hidden' }}>
        <thead>
          <tr>{cols.map((c) => <th key={c.key} style={{ textAlign: c.type === 'number' || c.type === 'money' ? 'right' : 'left', background: C, color: '#fff', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', padding: '8px 10px', fontWeight: 700 }}>{c.header ?? humanize(c.key)}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 ? '#F9FAFB' : '#fff' }}>
              {cols.map((c) => (
                <td key={c.key} style={{ padding: '7px 10px', borderTop: '1px solid #EEF0F2', textAlign: c.type === 'number' || c.type === 'money' ? 'right' : 'left', verticalAlign: 'top' }}>
                  {c.type === 'badge' && r[c.key] ? pill(r[c.key]) : <span style={{ fontWeight: c.type === 'date' || c.grow ? 700 : 400 }}>{text(c, r[c.key])}</span>}
                  {c.sub && r[c.sub] !== undefined && r[c.sub] !== '' && <div style={{ color: '#9CA3AF', fontSize: 9.5, marginTop: 2 }}>{text({ key: c.sub, type: ent?.types?.[c.sub] === 'numeric' ? 'number' : undefined }, r[c.sub])}{/pct|percent/i.test(c.sub) ? '%' : ''}</div>}
                </td>))}
            </tr>))}
          {!rows.length && <tr><td colSpan={cols.length} style={{ padding: 16, textAlign: 'center', color: '#9CA3AF' }}>No records match these filters.</td></tr>}
        </tbody>
      </table>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 14, paddingTop: 8, borderTop: `2px solid ${C}`, color: '#6B7280', fontSize: 9.5 }}>
        <div style={{ maxWidth: '78%', lineHeight: 1.5 }}>{spec.footer ?? ''}</div>
        <div style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#374151' }}>{OS.name} · {rows.length} {rows.length === 1 ? 'record' : 'records'}</div>
      </div>
    </div>
  );

  return (
    <Modal isOpen={open} onClose={onClose} title={`${title} — PDF`} size="xl">
      <div className="w-full space-y-4" data-os-list-pdf>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[13px] text-ink-3">{rows.length} {rows.length === 1 ? 'record' : 'records'} · {filterLine}</p>
          <Button type="primary" icon={<Printer className="w-4 h-4" />} onClick={print} data-os-print>Print / Save PDF</Button>
        </div>
        <div className="rounded-2xl border border-surface-border bg-white p-4 sm:p-6 max-h-[65vh] overflow-auto custom-scrollbar">
          <div ref={ref}>{sheet}</div>
        </div>
      </div>
    </Modal>
  );
}
