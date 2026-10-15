// Kernel primitives shared by blocks, sections and custom code. Small, tokenised, no brand hex anywhere.
// Every visual decision here is one the design guide already made: hairlines, one accent, colour = status.
import * as Icons from 'lucide-react';
import { cn } from '../../utils/cn';
import { formatValue } from '../../module/formula';
import { InitialsAvatar } from '../ProfileAvatar';

export const TONES = ['ok', 'warn', 'bad', 'info', 'neutral', 'brand'];

/** Map a status-like word to a tone. Shared by badges, callouts, kanban columns and KPI accents. */
export function toneOf(label) {
  const s = String(label ?? '').toLowerCase();
  if (!s) return 'neutral';
  if (/(overdue|rejected|critical|breach|failed|failure|negative|out of stock|low stock|cancel|unpaid|error|mismatch|defect|down|urgent|lost|blocked|high)/.test(s)) return 'bad';
  if (/(behind|at risk|slipping|overdue)/.test(s)) return 'bad';
  if (/(pending|awaiting|due|hold|warning|maintenance|unreconciled|draft|review|stale|idle|partial|medium|follow|carried|queued|verification|waiting)/.test(s)) return 'warn';
  if (/(on track|achieved|ahead|met)/.test(s)) return 'ok';
  if (/(completed|complete|resolved|closed|paid|approved|delivered|dispatched|success|passed|in stock|adequate|healthy|matched|reconciled|collected|available|running|active|good|won|verified|submitted|released|done)/.test(s)) return 'ok';
  if (/(in progress|processing|scheduled|ongoing|open|assigned|shipped|transit|new|contacted|qualified|quoted|negotiation|confirmed|ready)/.test(s)) return 'info';
  return 'neutral';
}

export const TONE_TEXT = { ok: 'text-ok-text', warn: 'text-warn-text', bad: 'text-bad-text', info: 'text-info-text', neutral: 'text-ink-2', brand: 'text-primary-600' };
export const TONE_DOT = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info', neutral: 'bg-ink-4', brand: 'bg-primary-500' };
export const TONE_SOFT = { ok: 'bg-ok-soft', warn: 'bg-warn-soft', bad: 'bg-bad-soft', info: 'bg-info-soft', neutral: 'bg-black/[0.05]', brand: 'bg-primary-50' };

export function icon(name) { return Icons[name] || Icons.Circle; }

/** Initials avatar — the same face as the sidebar / profile one (first + last word, a deterministic --cat-N tint). Props unchanged. */
export function Avatar({ name, size = 32, className }) {
  return <InitialsAvatar name={String(name ?? '?')} size={size} className={className} />;
}

/** A filter chip with an optional count. `pressed` is the selected state (aria-pressed drives the style). */
export function Chip({ label, count, pressed, onClick, icon: I, className }) {
  return (
    <button type="button" aria-pressed={pressed ? 'true' : 'false'} onClick={onClick} className={cn('chip', className)}>
      {I && <I className="w-3.5 h-3.5" />}
      <span className="truncate max-w-[180px]">{label}</span>
      {count !== undefined && <span className="chip-count">{count}</span>}
    </button>
  );
}

/** A horizontal chip row that scrolls sideways on phones instead of wrapping into three lines. */
export function ChipRow({ children, className, ...rest }) {
  return <div className={cn('flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1', className)} {...rest}>{children}</div>;
}

/** Progress track. `value`/`of` render the fraction; a tone colours the bar; `pct` alone also works. */
export function Progress({ value, of, pct, tone, label, className, compact, format }) {
  const p = pct ?? (of ? Math.round((Number(value) / Number(of)) * 100) : Number(value) || 0);
  const clamped = Math.min(100, Math.max(0, isFinite(p) ? p : 0));
  const t = tone === 'auto' ? (clamped >= 80 ? 'ok' : clamped >= 50 ? 'warn' : 'bad') : tone;
  // "₹21 L of ₹60 L · 35%" reads; "2100000 / 6000000 · 35%" does not (audit H8).
  const show = (n) => (format === 'money' ? formatValue(Number(n) || 0, 'money_l') : Number(n).toLocaleString('en-IN'));
  return (
    <div className={cn('min-w-0', className)} data-os-progress>
      {(label || of !== undefined) && !compact && (
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          {label && <span className="text-[12px] font-medium text-ink-2 truncate">{label}</span>}
          {of !== undefined && <span className="text-[12px] text-ink-3 tabular whitespace-nowrap">{show(value)} of {show(of)} <span className="text-ink-3">·</span> {clamped}%</span>}
        </div>
      )}
      <div className={cn('progress', t && t !== 'brand' && `progress-${t}`)} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/** A tinted note. Renders nothing when there is nothing to say — an empty callout is a lie about importance. */
export function Callout({ label, tone = 'neutral', icon: I, children, className }) {
  if (children === null || children === undefined || children === '') return null;
  const Ico = I ?? (tone === 'warn' ? Icons.AlertTriangle : tone === 'ok' ? Icons.CheckCircle2 : tone === 'bad' ? Icons.AlertOctagon : tone === 'info' ? Icons.Info : Icons.StickyNote);
  return (
    <div className={cn('callout', `callout-${tone}`, className)} data-os-callout>
      {label && <p className="callout-label"><Ico className="w-3.5 h-3.5" />{label}</p>}
      <div className="break-words">{children}</div>
    </div>
  );
}

/** One label / value pair on a subdued surface. */
export function Tile({ label, value, className }) {
  return (
    <div className={cn('tile', className)} data-os-tile>
      <p className="tile-label" title={label}>{label}</p>
      <p className="tile-value">{value === '' || value === undefined || value === null ? '—' : value}</p>
    </div>
  );
}

/** A grid of tiles: 2 across on phones, up to 4 on desktop. */
export function Tiles({ items, columns = 4, className }) {
  const cols = Math.min(4, Math.max(1, columns));
  return <div className={cn('grid grid-cols-2 gap-2.5', cols >= 3 && 'md:grid-cols-3', cols >= 4 && 'lg:grid-cols-4', className)}>{items.map((t, i) => <Tile key={t.key ?? i} label={t.label} value={t.value} />)}</div>;
}

/** Score ring: a value out of max with a label. The ring colour follows the value's tone. */
export function ScoreRing({ value, max = 100, size = 64, label, sublabel, tone }) {
  const v = Number(value) || 0; const pct = Math.min(100, Math.max(0, (v / (Number(max) || 100)) * 100));
  const t = tone ?? (pct >= 75 ? 'ok' : pct >= 45 ? 'warn' : 'bad');
  const r = (size - 6) / 2; const c = 2 * Math.PI * r;
  const stroke = { ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--info)', brand: 'var(--primary)', neutral: 'var(--ink-4)' }[t];
  return (
    <div className="flex items-center gap-4 min-w-0" data-os-score>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={`${v} of ${max}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.4s var(--ease)' }} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="tabular" style={{ fontSize: size * 0.3, fontWeight: 600, fill: 'var(--ink)' }}>{v}</text>
      </svg>
      <div className="min-w-0">
        {label && <p className="text-[15px] font-semibold text-ink truncate">{label}</p>}
        {sublabel && <p className="text-[12px] text-ink-3 truncate">{sublabel}</p>}
      </div>
    </div>
  );
}

/** Icon-in-a-circle used by KPI cards and person cards when a tone is declared. Neutral by default. */
export function IconDisc({ icon: I, tone = 'neutral', size = 36 }) {
  const text = { ok: 'text-ok-text', warn: 'text-warn-text', bad: 'text-bad-text', info: 'text-info-text', brand: 'text-primary-600', neutral: 'text-ink-3' }[tone];
  return <span className={cn('inline-flex items-center justify-center rounded-full shrink-0', TONE_SOFT[tone], text)} style={{ width: size, height: size }}><I className="w-4 h-4" strokeWidth={1.75} /></span>;
}

/** Segmented view toggle (table / cards / kanban). Icon + label on desktop, icon only on phones. */
export function ViewToggle({ value, options, onChange }) {
  const ICON = { table: Icons.List, cards: Icons.LayoutGrid, kanban: Icons.Columns3, grouped: Icons.Layers, timeline: Icons.History };
  const LABEL = { table: 'Table', cards: 'Cards', kanban: 'Board', grouped: 'Groups', timeline: 'Timeline' };
  return (
    <div className="inline-flex items-center rounded-full bg-black/[0.04] p-[3px] shrink-0" role="tablist" data-os-view-toggle>
      {options.map((o) => { const I = ICON[o] ?? Icons.Circle; const on = o === value; return (
        <button key={o} type="button" role="tab" aria-selected={on} aria-label={`${LABEL[o] ?? o} view`} data-view={o} onClick={() => onChange(o)}
          className={cn('no-pill inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium transition-colors', on ? 'bg-white text-ink shadow-[0_1px_2px_rgba(0,0,0,0.06)]' : 'text-ink-3 hover:text-ink')}>
          <I className="w-3.5 h-3.5" /><span className="hidden sm:inline">{LABEL[o] ?? o}</span>
        </button>); })}
    </div>
  );
}

/** Key/value rows with a leading icon — contact details, assignee, client, due date. */
export function MetaRow({ icon: I, label, children, className }) {
  return (
    <div className={cn('flex items-center gap-2 text-[13px] min-w-0', className)}>
      {I && <I className="w-3.5 h-3.5 text-ink-4 shrink-0" strokeWidth={1.75} />}
      {label && <span className="text-ink-3 shrink-0">{label}:</span>}
      <span className="text-ink font-medium truncate">{children}</span>
    </div>
  );
}

/** Comma-separated cell → chips. */
export function TagList({ value, tone = 'neutral', max = 4 }) {
  const items = String(value ?? '').split(/[,;|]\s*/).map((s) => s.trim()).filter(Boolean);
  if (!items.length) return null;
  const cls = { ok: 'badge-success', warn: 'badge-warning', bad: 'badge-danger', info: 'badge-info', neutral: 'badge-neutral', brand: 'badge-brand' }[tone];
  return <div className="flex flex-wrap gap-1.5">{items.slice(0, max).map((t) => <span key={t} className={cn('badge', cls)} title={t}><span className="truncate max-w-[200px]">{t}</span></span>)}{items.length > max && <span className="badge badge-neutral">+{items.length - max}</span>}</div>;
}
