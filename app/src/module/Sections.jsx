// Sections — the one renderer for record detail, whether it opens as a page (DetailPage), a slide-in
// (Drawer) or a profile tab. A section is declared in os.yaml; the vocabulary:
//   fields    label/value grid of the record's own columns
//   tiles     the same, as subdued tiles — specs, key figures ("Machine specifications")
//   score     a ring for a 0–max column with a label and optional bands ("Lead quality score")
//   card      one person / one thing: avatar, title, subtitle lines and an optional action ("Assigned representative")
//   linked    the latest related record as a compact card with its own actions ("Associated quotation")
//   list      related rows as label · value lines ("Matching standard prices"), matched by a column or `by`
//   timeline  related rows as a vertical timeline ("Lead activity history")
//   related   related rows as a table (unchanged)
//   callout   a tinted note from one column ("Requirement notes", "Reason for pending")
//   progress  a fraction from two columns ("5 of 7 tasks")
//   custom    a registered component
// `rail: true` on a section places it in the right column of a detail page (`detail.layout: rail`).
import { Link } from '../lib/router';
import { Button } from 'antd';
import { format } from 'date-fns';
import * as Icons from 'lucide-react';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { Avatar, Callout, Progress, ScoreRing, Tiles, MetaRow, icon, toneOf } from '../components/ui/primitives';
import { renderCell } from './cells';
import { toDate, toNum, where, formatValue } from './formula';
import { formatPhone } from '../components/ui/ContactActions';
import { ENTITIES } from '../config/os.config';
import { CUSTOM } from '../custom';
import { CARD, SECTION_TITLE } from './Charts';
import { cn } from '../utils/cn';
import { humanize, labelOf } from '../utils/labels';

const label = (c) => humanize(c);

/** The heading a section carries (its own `title`, else the one its type implies) — also the accordion trigger on a long detail page. */
export function sectionTitle(s) {
  if (s.title) return s.title;
  switch (s.type) {
    case 'fields': return 'Details';
    case 'tiles': return 'Specifications';
    case 'score': return label(s.column);
    case 'card': return label(s.column ?? '');
    case 'timeline': return 'Activity';
    case 'callout': return s.column ? label(s.column) : 'Note';
    case 'progress': return label(s.value);
    case 'linked': case 'list': case 'related': return label(s.entity);
    default: return label(s.name ?? s.type ?? 'Section');
  }
}
export const guessType = (c, ent) => (c === ent?.status?.column ? 'badge' : /_At$|_Date$/.test(c) ? 'date' : /_INR$|Amount|Total|Price/.test(c) ? 'money' : 'text');
export function fmt(row, c, ent) {
  const v = row?.[c]; if (v === undefined || v === null || v === '') return '—';
  const t = guessType(c, ent);
  if (t === 'date') { const d = toDate(v); return d ? format(d, 'dd MMM yyyy') : String(v); }
  if (t === 'money') return formatValue(toNum(v), 'money');
  const b = { true: 'Active', false: 'Inactive' }[String(v).trim().toLowerCase()];   // a boolean column reads as a word
  if (ent?.contact && (c === ent.contact.phone || c === ent.contact.whatsapp)) return formatPhone(v);   // +91 98700 11132
  return b ?? String(v);
}

// 24 Oct 2026: a value that is a web address (http/https only — never javascript: or data:) renders as a button that opens it
// in a new tab, with the site's name under it; a section's `link_label` names the button (default "Open link"). A Google News
// RSS link goes through /api/out/<entity>/<id>?col= — the server resolves it to the publisher's page (lib/outLink.ts), since
// Google's own redirect page can fail with a 400 in the browser.
const webUrl = (v) => { const s = String(v ?? '').trim(); if (!/^https?:\/\/\S+$/i.test(s)) return null; try { return new URL(s); } catch { return null; } };
const isGoogleNews = (u) => u.hostname === 'news.google.com' && /^\/(rss\/)?(articles|read)\//.test(u.pathname);
const entityName = (ent) => Object.keys(ENTITIES).find((k) => ENTITIES[k] === ent);
function UrlButton({ url, label, out }) {
  const I = Icons.ExternalLink; const gn = isGoogleNews(url) && out;
  return (
    <div className="min-w-0">
      <a href={gn ? out : url.href} target="_blank" rel="noopener noreferrer" data-os-url-button title={url.href}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--r-8)] bg-primary-500 text-white text-[13px] font-medium hover:bg-primary-600 transition-colors">
        <I className="w-3.5 h-3.5" />{label}
      </a>
      <p className="text-[12px] text-ink-3 mt-1 truncate font-normal">{gn ? "Opens the publisher's page (via Google News)" : url.hostname.replace(/^www\./, '')}</p>
    </div>
  );
}

export function relatedRows(s, ctx) {
  let rows = ctx.data[s.entity] ?? [];
  if (s.by) rows = rows.filter((r) => String(r[s.by]) === String(ctx.row[ctx.idc]));
  else if (s.match) rows = rows.filter((r) => String(r[s.match.column] ?? '') === String(ctx.row[s.match.equals ?? s.match.column] ?? ''));
  return where(rows, s.where, ctx.user);
}

// `bare` sections sit inside an accordion panel that already carries the title: the heading is dropped, an action beside it stays.
function Head({ title, right, bare }) {
  if (bare) return right ? <div className="flex justify-end mb-3">{right}</div> : null;
  return <div className="flex items-baseline justify-between gap-3 mb-3"><h3 className={SECTION_TITLE}>{title}</h3>{right}</div>;
}

/** Render one section. `compact` (drawer) drops the card chrome and stacks everything in one column. */
export function renderSection(s, i, ctx) {
  const { row, ent, idc, compact } = ctx;
  const L = (c) => (ctx.t ? labelOf(ctx.t, c) : humanize(c));   // a column's label, in the person's language when the caller passed `t`
  const shell = (children, extra) => compact
    ? <section key={i} className={cn('min-w-0', extra)}>{children}</section>
    : <div key={i} className={cn(CARD, 'p-5', extra)}>{children}</div>;

  switch (s.type) {
    case 'fields': {
      // `hide_empty` (default in a drawer) drops columns with no value — a grid of "—" says nothing (H5).
      // `skip:` drops columns shown elsewhere in the header (status, score, the due date, the owner).
      const skip = new Set([...(s.skip ?? []), ...(compact ? [ent.status?.column, ent.due?.column, ent.owner, 'Score'].filter(Boolean) : [])]);
      let cols = (s.columns ?? ent.columns.filter((c) => c !== idc)).filter((c) => !skip.has(c));
      if (s.hide_empty) cols = cols.filter((c) => fmt(row, c, ent) !== '—');
      if (!cols.length) return null;
      return shell(<>
        <Head bare={ctx.bare} title={s.title ?? 'Details'} />
        <dl className={cn('grid gap-x-4 gap-y-3', compact || s.rail ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4')}>
          {cols.map((c) => { const url = webUrl(row[c]); return <div key={c} className="min-w-0"><dt className="text-[12px] text-ink-3 mb-0.5">{L(c)}</dt><dd className="text-[14px] font-medium text-ink break-words">{url ? <UrlButton url={url} label={s.link_label ?? 'Open link'} out={entityName(ent) && row[idc] ? `/api/out/${entityName(ent)}/${encodeURIComponent(row[idc])}?col=${encodeURIComponent(c)}` : null} /> : guessType(c, ent) === 'badge' && row[c] ? <StatusBadge status={row[c]} /> : fmt(row, c, ent)}</dd></div>; })}
        </dl>
      </>);
    }
    case 'tiles': {
      const cols = s.columns ?? ent.columns.filter((c) => c !== idc).slice(0, 4);
      return shell(<>
        <Head bare={ctx.bare} title={s.title ?? 'Specifications'} />
        <Tiles columns={compact || s.rail ? 2 : Math.min(4, cols.length)} items={cols.map((c) => ({ key: c, label: L(c), value: fmt(row, c, ent) }))} />
      </>);
    }
    case 'score': {
      const v = toNum(row[s.column]); const max = s.max ?? 100;
      const band = (s.bands ?? []).find((b) => v >= (b.min ?? 0)) ?? null;
      return shell(<>
        <Head bare={ctx.bare} title={s.title ?? label(s.column)} />
        <ScoreRing value={v} max={max} label={band?.label ?? s.label} sublabel={s.sublabel ?? (s.label_column ? row[s.label_column] : undefined)} tone={band?.tone} />
        {s.bar && <Progress compact className="mt-4" pct={Math.round((v / max) * 100)} tone={band?.tone ?? 'auto'} />}
      </>);
    }
    case 'card': {
      const name = row[s.column ?? s.columns?.[0]] || (s.empty ?? 'Unassigned'); const lines = (s.columns ?? []).filter((c) => c !== (s.column ?? s.columns?.[0]));
      const act = s.action ? (ctx.actions ?? []).find((a) => a.id === s.action) : null;
      return shell(<>
        <Head bare={ctx.bare} title={s.title ?? label(s.column ?? '')} />
        <div className="flex items-center gap-3 min-w-0">
          {s.avatar !== false && <Avatar name={name} size={40} />}
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink truncate">{name || '—'}</p>
            {lines.length > 0 && <p className="text-[12px] text-ink-3 truncate">{lines.map((c) => fmt(row, c, ent)).filter((x) => x !== '—').join(' · ') || '—'}</p>}
          </div>
        </div>
        {act && <Button className="mt-3 w-full" data-os-action={act.id} onClick={() => ctx.openModal?.(act)}>{act.title}</Button>}
      </>);
    }
    case 'linked': {
      const re = ENTITIES[s.entity]; const rel = relatedRows(s, ctx).sort((a, b) => (toDate(b[re.created ?? s.date])?.getTime() ?? 0) - (toDate(a[re.created ?? s.date])?.getTime() ?? 0));
      const r = rel[0]; const cols = s.columns ?? re.columns.slice(1, 4); const acts = (s.actions ?? []).map((id) => (ctx.actions ?? []).find((a) => a.id === id)).filter(Boolean);
      return shell(<>
        <Head bare={ctx.bare} title={s.title ?? label(s.entity)} right={r && re.status?.column && <StatusBadge status={r[re.status.column]} size="small" />} />
        {!r ? <p className="text-[13px] text-ink-3">{s.empty ?? 'None yet.'}</p> : (
          <div className="rounded-lg bg-surface-2 border border-[color:var(--hair-5)] px-3.5 py-3 space-y-1">
            <p className="text-[13px] font-semibold text-ink tabular">{r[re.id.column]}</p>
            {cols.filter((c) => c !== re.id.column && c !== re.status?.column).map((c) => <p key={c} className={cn('text-[13px]', guessType(c, re) === 'money' ? 'text-[17px] font-semibold text-ink tabular' : 'text-ink-2')}>{fmt(r, c, re)}</p>)}
          </div>)}
        {r && acts.length > 0 && <div className="flex gap-2 mt-3">{acts.map((a, j) => <Button key={a.id} data-os-action={a.id} type={j === 0 ? 'primary' : 'default'} className="flex-1" onClick={() => ctx.openModal?.(a, r)}>{a.title}</Button>)}</div>}
        {rel.length > 1 && <p className="text-[11px] text-ink-3 mt-2">{rel.length - 1} earlier</p>}
      </>);
    }
    case 'list': {
      const re = ENTITIES[s.entity]; const rel = relatedRows(s, ctx).slice(0, s.limit ?? 5); const valueType = s.value_type ?? guessType(s.value, re);
      return shell(<>
        <Head bare={ctx.bare} title={s.title ?? label(s.entity)} />
        {!rel.length ? <p className="text-[13px] text-ink-3">{s.empty ?? 'None yet.'}</p> : (
          <ul className="space-y-1.5" data-os-list>
            {rel.map((r, j) => <li key={j} className="flex items-center justify-between gap-3 rounded-sm bg-surface-2 border border-[color:var(--hair-5)] px-3 py-2 text-[13px]"><span className="text-ink-2 truncate">{r[s.label]}</span><span className="text-ink font-semibold tabular whitespace-nowrap">{valueType === 'money' ? formatValue(toNum(r[s.value]), 'money') : r[s.value]}</span></li>)}
          </ul>)}
      </>);
    }
    case 'timeline': {
      const rel = relatedRows(s, ctx).sort((a, b) => (toDate(b[s.date])?.getTime() ?? 0) - (toDate(a[s.date])?.getTime() ?? 0)).slice(0, s.limit ?? 20);
      const act = s.action ? (ctx.actions ?? []).find((a) => a.id === s.action) : null;
      return shell(<>
        <Head bare={ctx.bare} title={`${s.title ?? 'Activity'}${rel.length ? ` (${rel.length})` : ''}`} right={act && <Button size="small" data-os-action={act.id} onClick={() => ctx.openModal?.(act)}>{act.title}</Button>} />
        {!rel.length ? <p className="text-[13px] text-ink-3">{s.empty ?? 'Nothing logged yet.'}</p> : (
          <ol className="relative ml-2 border-l border-black/[0.08] space-y-4" data-os-timeline>
            {rel.map((r, j) => { const d = toDate(r[s.date]); const t = toneOf(r[s.status]); return (
              <li key={j} className="pl-5 relative">
                <span className={cn('absolute -left-[5px] top-1.5 w-[9px] h-[9px] rounded-full border-2 border-white', { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', info: 'bg-info' }[t] ?? 'bg-ink-4')} />
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">{s.actor && r[s.actor] && <span className="text-[13px] font-semibold text-ink">{r[s.actor]}</span>}{s.status && r[s.status] && <StatusBadge status={r[s.status]} size="small" />}{(!s.actor || !r[s.actor]) && s.title_column && <span className="text-[13px] font-semibold text-ink">{r[s.title_column]}</span>}</div>
                  {d && <span className="text-[11px] text-ink-3 tabular whitespace-nowrap">{format(d, 'dd MMM yyyy, HH:mm')}</span>}
                </div>
                {s.actor && r[s.actor] && s.title_column && r[s.title_column] && <p className="text-[13px] text-ink mt-0.5 break-words">{r[s.title_column]}</p>}
                {s.body && r[s.body] && <p className="text-[13px] text-ink-2 mt-0.5 break-words">{r[s.body]}</p>}
              </li>); })}
          </ol>)}
      </>);
    }
    case 'related': {
      const re = ENTITIES[s.entity]; const rel = relatedRows(s, ctx);
      const cols = (s.columns ?? re.columns.slice(0, compact ? 4 : 6)).map((c) => ({ accessorKey: c, header: label(c), cell: ({ getValue, row: r }) => renderCell({ key: c, type: guessType(c, re) }, getValue(), r.original, {}) }));
      if (compact) return <section key={i}><Head bare={ctx.bare} title={`${s.title ?? label(s.entity)} · ${rel.length}`} />{rel.length ? <div className="rounded-lg border border-[color:var(--hair-6)] overflow-hidden"><DataTable data={rel.slice(0, s.limit ?? 8)} columns={cols} pager={false} cards /></div> : <p className="text-[13px] text-ink-3">None yet.</p>}</section>;
      return (
        <div key={i} className={CARD}>
          <div className="p-4 border-b border-[color:var(--hair-5)] flex items-center justify-between"><h3 className={SECTION_TITLE}>{s.title ?? label(s.entity)}</h3><span className="text-xs text-ink-3 tabular">{rel.length}</span></div>
          {rel.length ? <DataTable data={rel} columns={cols} pageSize={5} /> : <p className="p-5 text-[13px] text-ink-3">None yet.</p>}
        </div>);
    }
    case 'callout': {
      const text = s.column ? row[s.column] : s.text;
      if (!text && s.hide_empty !== false) return null;
      return shell(<><Head bare={ctx.bare} title={s.title ?? (s.column ? label(s.column) : 'Note')} /><Callout tone={s.tone ?? 'neutral'} label={s.label}>{text || '—'}</Callout></>);
    }
    case 'progress': {
      const value = toNum(row[s.value]); const of = s.of_column ? toNum(row[s.of_column]) : (s.of ?? 100);
      return shell(<><Head bare={ctx.bare} title={s.title ?? label(s.value)} /><Progress value={value} of={of} label={s.label} tone={s.tone ?? 'auto'} /></>);
    }
    case 'custom': {
      const C = CUSTOM[s.name];
      return C ? <C key={i} row={row} data={ctx.data} reload={ctx.reload} openModal={(mid) => { const m = (ctx.actions ?? []).find((a) => a.id === mid) ?? ctx.modals?.find((a) => a.id === mid); if (m) ctx.openModal?.(m); }} />
        : <div key={i} data-custom-stub={s.name} className={cn(compact ? 'rounded-lg' : CARD, 'border-dashed border-warn/40 bg-warn-soft p-4 text-sm text-warn-text')}>Custom section <b>{s.name}</b> pending (step 4).</div>;
    }
    default: return null;
  }
}

/** Contact-style meta list used by cards and detail headers: [{icon, label, column}] */
export function MetaList({ items, row, ent }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">{items.map((m) => { const I = m.icon ? icon(m.icon) : Icons.Dot; return <MetaRow key={m.column} icon={I} label={m.label}>{fmt(row, m.column, ent)}</MetaRow>; })}</div>;
}

export { Link };
