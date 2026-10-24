// HeaderTools — global search and the notifications bell (os.yaml header.search / header.notifications).
// Search (audit H7): ⌘K / Ctrl-K, matches every declared column (name, company, phone, city, machine, quotation
// number…), results grouped by type, recent records remembered per person. Notifications (M7): each source is a
// metric from the dictionary, so the bell count is the same number the KPIs show; rows read "Follow-up overdue
// 3 days · Hardik Patel · Kiran Auto", are grouped Today / Earlier, can be marked read, and link to the list.
// v4.9: the language switch (C9) renders here, on the right, only when the OS declares more than one language; every icon-only
// button carries an aria-label AND a Tooltip (C8).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from '../lib/router';
import { Bell, Search, X, Clock, ArrowRight } from 'lucide-react';
import { differenceInCalendarDays, format, isToday } from 'date-fns';
import { HEADER, ENTITIES, OS } from '../config/os.config';
import { ROLE_PERMISSIONS } from '../config/roles';
import { useAuth } from '../context/AuthContext';
import { useEntities } from '../hooks/useEntity';
import { where, toDate } from '../module/formula';
import { titleOf, subtitleOf } from '../module/record';
import { cn } from '../utils/cn';
import { Tooltip } from 'antd';
import { useT } from '../i18n';
import { humanize } from '../utils/labels';
import LanguageSwitch from './LanguageSwitch';
import { LANGUAGES } from '../config/i18n';

function usePopover() {
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => { const on = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; const esc = (e) => e.key === 'Escape' && setOpen(false); document.addEventListener('mousedown', on); document.addEventListener('keydown', esc); return () => { document.removeEventListener('mousedown', on); document.removeEventListener('keydown', esc); }; }, []);
  return { open, setOpen, ref };
}
const linkFor = (spec, row) => (spec.link ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => encodeURIComponent(row[k] ?? ''));
const KEY = (k) => `${OS.slug}_${k}`;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(KEY(k)) || 'null') ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch { /* private mode */ } };
/** "3 days overdue" · "due today" · "in 2 days" · "2 days ago" — the age of a dated row, in words. */
function age(spec, row) {
  const d = toDate(row[spec.date]); if (!d) return '';
  const n = differenceInCalendarDays(new Date(), d);
  if (spec.age === 'due') return n > 0 ? `${n} day${n === 1 ? '' : 's'} overdue` : n === 0 ? 'due today' : `in ${-n} day${n === -1 ? '' : 's'}`;
  return n === 0 ? 'today' : n === 1 ? 'yesterday' : n > 1 ? `${n} days ago` : `in ${-n} days`;
}

export default function HeaderTools({ slot = 'all' }) {   // slot: 'search' (the header's centre) · 'tools' (the bell, right) · 'all'
  const t = useT(); const { user } = useAuth(); const perms = ROLE_PERMISSIONS[user?.role] ?? []; const can = (pid) => !pid || perms.includes('*') || perms.includes(pid);
  const search = (HEADER.search ?? []).filter((s) => can(s.page)); const notes = (HEADER.notifications ?? []).filter((s) => can(s.page));
  const showSearch = slot !== 'tools' && search.length > 0; const showNotes = slot !== 'search' && notes.length > 0;
  const { data } = useEntities([...new Set([...search, ...notes].map((s) => s.entity))]);
  const navigate = useNavigate();
  const S = usePopover(); const N = usePopover(); const [q, setQ] = useState('');
  // 24 Oct 2026: the first render matches the server's (which has no localStorage) — read marks and recent searches load after
  // mount; reading them in useState's initialiser made the bell's count differ on hydration ("6 unread" server, "0" client).
  const [recent, setRecent] = useState([]);
  const [read, setRead] = useState(() => new Set());
  useEffect(() => { setRecent(load('recent', [])); setRead(new Set(load('read', []))); }, []);
  const groups = useMemo(() => {
    if (q.trim().length < 2) return [];
    const t = q.toLowerCase();
    return search.map((s) => ({ s, rows: (data[s.entity] ?? []).filter((r) => (s.columns ?? []).some((c) => String(r[c] ?? '').toLowerCase().includes(t))).slice(0, 5) })).filter((g) => g.rows.length);
  }, [q, data, search]);
  const items = useMemo(() => notes.flatMap((s) => where(data[s.entity] ?? [], s.where, user).map((r) => ({ s, r, key: `${s.metric ?? s.label}:${r[ENTITIES[s.entity]?.id?.column]}` }))).sort((a, b) => (toDate(a.r[a.s.date])?.getTime() ?? 0) - (toDate(b.r[b.s.date])?.getTime() ?? 0)), [data, notes, user]);
  const unread = items.filter((it) => !read.has(it.key));
  const byLabel = useMemo(() => { const m = new Map(); for (const it of items) m.set(it.s.label, (m.get(it.s.label) ?? 0) + 1); return [...m.entries()]; }, [items]);
  const today = unread.filter((it) => { const d = toDate(it.r[it.s.date]); return d && (isToday(d) || (it.s.age === 'due' && d < new Date())); });
  const earlier = unread.filter((it) => !today.includes(it));
  const pick = (s, r) => { S.setOpen(false); setQ(''); const ent = ENTITIES[s.entity]; const entry = { label: s.label, title: titleOf(r, ent, s), sub: subtitleOf(r, ent, s), link: linkFor(s, r) }; const next = [entry, ...recent.filter((x) => x.link !== entry.link)].slice(0, 6); setRecent(next); save('recent', next); navigate(entry.link); };
  const markAll = () => { const n = new Set([...read, ...items.map((it) => it.key)]); setRead(n); save('read', [...n]); };
  useEffect(() => {
    if (!showSearch) return;   // only the instance that renders the search listens for Ctrl-K
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); S.setOpen((o) => !o); } if (e.key === 'Escape') { S.setOpen(false); N.setOpen(false); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [showSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const showLang = slot !== 'search' && LANGUAGES.length > 1;
  if (!showSearch && !showNotes && !showLang) return null;
  const Row = ({ s, r }) => { const ent = ENTITIES[s.entity]; return (
    <button onClick={() => pick(s, r)} className="no-pill w-full text-left px-4 py-2 hover:bg-black/[0.03] flex items-center gap-3 rounded-none">
      <span className="min-w-0"><span className="block text-[13px] font-medium text-ink truncate">{titleOf(r, ent, s)}</span><span className="block text-[12px] text-ink-3 truncate">{subtitleOf(r, ent, s) || r[ent?.id?.column]}</span></span>
    </button>); };
  return (
    <div className="flex items-center gap-1.5">
      {showLang && <LanguageSwitch />}
      {showSearch && (
        <div ref={S.ref} className="relative">
          <Tooltip title={`${t('Search')} (Ctrl+K)`}><button onClick={() => S.setOpen(!S.open)} aria-label={t('Search')} data-os-global-search className="no-pill w-10 h-10 rounded-[var(--r-8)] flex items-center justify-center text-ink-2 hover:bg-black/[0.04] hover:text-ink transition-colors"><Search className="w-[18px] h-[18px]" /></button></Tooltip>
          {S.open && (
            <div className="fixed sm:absolute left-2 right-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 top-14 sm:top-12 sm:w-[420px] bg-white rounded-[var(--r-10)] shadow-overlay border border-surface-border z-50 overflow-hidden" data-os-popover>
              <div className="p-3 border-b border-surface-border flex items-center gap-2"><Search className="w-4 h-4 text-ink-3" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={HEADER.search_placeholder ?? 'Search leads, quotations, phone, city…'} aria-label="Search" className="flex-1 outline-none text-[14px] bg-transparent" style={{ borderRadius: 0, minHeight: 0 }} />{q ? <Tooltip title={t('Clear')}><button onClick={() => setQ('')} aria-label={t('Clear')} className="no-pill"><X className="w-4 h-4 text-ink-3" /></button></Tooltip> : <kbd className="text-[11px] text-ink-3 border border-surface-border rounded px-1.5 py-0.5 font-mono">Ctrl K</kbd>}</div>
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar py-1">
                {groups.map((g) => (
                  <div key={g.s.label} data-os-search-group={g.s.label}>
                    <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{g.s.label} · {g.rows.length}</p>
                    {g.rows.map((r, i) => <Row key={i} s={g.s} r={r} />)}
                  </div>
                ))}
                {q.trim().length >= 2 && !groups.length && <p className="px-4 py-6 text-[13px] text-ink-3">No matches for "{q}". Try a name, company, phone, city or machine.</p>}
                {q.trim().length < 2 && recent.length > 0 && (
                  <div data-os-search-recent>
                    <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3 flex items-center gap-1"><Clock className="w-3 h-3" /> Recent</p>
                    {recent.map((e, i) => <button key={i} onClick={() => { S.setOpen(false); navigate(e.link); }} className="no-pill w-full text-left px-4 py-2 hover:bg-black/[0.03] flex items-center gap-3 rounded-none"><span className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 w-20 shrink-0 truncate">{e.label}</span><span className="min-w-0"><span className="block text-[13px] font-medium text-ink truncate">{e.title}</span>{e.sub && <span className="block text-[12px] text-ink-3 truncate">{e.sub}</span>}</span></button>)}
                  </div>
                )}
                {q.trim().length < 2 && !recent.length && <p className="px-4 py-6 text-[12px] text-ink-3">Type at least two letters. Searches {search.map((s) => s.label.toLowerCase()).join(', ')} by {[...new Set(search.flatMap((s) => s.columns ?? []))].slice(0, 6).map((c) => humanize(c).toLowerCase()).join(', ')}.</p>}
              </div>
            </div>
          )}
        </div>
      )}
      {showNotes && (
        <div ref={N.ref} className="relative">
          <Tooltip title={t('Notifications')}><button onClick={() => N.setOpen(!N.open)} aria-label={`${t('Notifications')}, ${unread.length} ${t('unread')}`} data-os-notifications data-os-note-count={unread.length} className="no-pill relative w-10 h-10 rounded-[var(--r-8)] flex items-center justify-center text-ink-2 hover:bg-black/[0.04] hover:text-ink transition-colors">
            <Bell className="w-[18px] h-[18px]" />{unread.length > 0 && <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-bad text-white text-[11px] font-semibold flex items-center justify-center tabular">{unread.length > 99 ? '99+' : unread.length}</span>}
          </button></Tooltip>
          {N.open && (
            <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 top-14 sm:top-12 sm:w-[400px] bg-white rounded-[var(--r-10)] shadow-overlay border border-surface-border z-50 overflow-hidden" data-os-popover>
              <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between gap-2">
                <div className="min-w-0"><p className="text-[13px] font-semibold text-ink">Needs attention · {unread.length}</p><p className="text-[12px] text-ink-3 truncate">{byLabel.map(([l, n]) => <span key={l} data-os-note-label={l} data-os-note-label-count={n} data-os-note-metric={notes.find((s) => s.label === l)?.metric}>{l} {n}</span>).reduce((acc, el, i) => (i ? [...acc, ' · ', el] : [el]), [])}</p></div>
                {unread.length > 0 && <button onClick={markAll} className="no-pill text-[12px] font-medium text-primary-600 hover:underline shrink-0" data-os-mark-read>Mark all read</button>}
              </div>
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {[['Today', today], ['Earlier', earlier]].filter(([, l]) => l.length).map(([label, list]) => (
                  <div key={label}>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
                    {list.map((it) => { const ent = ENTITIES[it.s.entity]; return (
                      <Link key={it.key} to={linkFor(it.s, it.r)} onClick={() => N.setOpen(false)} className="block px-4 py-2.5 hover:bg-black/[0.03]" data-os-note-row data-os-note-metric={it.s.metric}>
                        <p className="text-[13px] text-ink truncate"><span className={cn('font-semibold', it.s.tone === 'bad' ? 'text-bad-text' : it.s.tone === 'warn' ? 'text-warn-text' : 'text-ink')}>{it.s.label}</span>{it.s.date && age(it.s, it.r).toLowerCase() !== it.s.label.toLowerCase() && <span className="text-ink-2"> {age(it.s, it.r)}</span>} · {titleOf(it.r, ent, it.s)}{subtitleOf(it.r, ent, it.s) && <span className="text-ink-3"> · {subtitleOf(it.r, ent, it.s)}</span>}</p>
                      </Link>); })}
                  </div>
                ))}
                {!unread.length && <p className="px-4 py-6 text-[13px] text-ink-3">All clear — nothing is waiting on you.</p>}
              </div>
              {notes.some((s) => s.link) && (
                <div className="px-4 py-2 border-t border-surface-border flex flex-wrap gap-x-4 gap-y-1">
                  {notes.filter((s) => s.link).map((s) => <Link key={s.label} to={s.link.replace(/\{\{\w+\}\}.*$/, '')} onClick={() => N.setOpen(false)} className="text-[12px] font-medium text-primary-600 hover:underline inline-flex items-center gap-1" data-os-note-viewall>{s.label} <ArrowRight className="w-3 h-3" /></Link>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
