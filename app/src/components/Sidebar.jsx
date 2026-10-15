// Sidebar — the navigation shell. Two shapes, chosen per portal in os.yaml (design.shell / portals[].shell):
//   sidebar  one column: mark · optional primary action · groups → items → children · portal switch · profile
//   rail     an icon rail (one icon per section) beside a section panel listing that section's pages —
//            the shape for portals with many pages in a few clear areas (Sales / Service / Masters / Company)
// Colours come only from the --nav-* tokens (light / tinted / dark are generated), so the same component
// paints every client's shell. Every item may carry a live count (`badge: { entity, where }`) or a static chip
// (`badge: Preview`), and a page may be reached from a primary action at the top (`design.sidebar.action`).
// The account menu (Profile & settings · Sign out) is the profile at the bottom-left of every shell (ProfileMenu) — never in
// the rail's item list and no longer in the header (Haresh review Oct 2026). The active pill is neutral with a 3px brand
// marker — the one place the brand colour appears in the chrome.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from '../lib/router';
import { motion, LayoutGroup } from 'framer-motion';
import { GLIDE, D, E, prefersReducedMotion } from '../config/motion';
import * as Icons from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../config/roles';
import { NAV, PORTALS, portalFor } from '../config/nav';
import { DESIGN, shellFor } from '../config/design';
import { useEntities } from '../hooks/useEntity';
import { where } from '../module/formula';
import { cn } from '../utils/cn';
import ProfileAvatar from './ProfileAvatar';
import { LogOut, UserRound } from 'lucide-react';
import { useNavigate } from '../lib/router';
import { ROLE_LABELS } from '../config/roles';
import BrandMark from './BrandMark';
import { useT } from '../i18n';

// One hover indicator per nav. It is a single absolutely-positioned box that moves to whichever
// item the pointer is over (measured, not a per-item background), so moving down the list reads as
// one object gliding — never two items lit at once, never a flash when crossing a gap. It fades
// out in place on leave and never sits on the active item (that one has its own pill).
function HoverNav({ className, children }) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);       // { top, left, width, height } in the nav's scroll space
  const [shown, setShown] = useState(false);
  const measure = (el) => {
    const nav = ref.current; if (!nav || !el) return null;
    const r = el.getBoundingClientRect(); const n = nav.getBoundingClientRect();
    return { top: r.top - n.top + nav.scrollTop, left: r.left - n.left + nav.scrollLeft, width: r.width, height: r.height };
  };
  const onMove = (e) => {
    const el = e.target.closest?.('[data-nav-item]');
    if (!el || !ref.current?.contains(el)) { setShown(false); return; }
    if (el.dataset.active === 'true') { setShown(false); return; }
    const b = measure(el); if (!b) return;
    setBox((prev) => (prev && Math.abs(prev.top - b.top) < 0.5 && Math.abs(prev.height - b.height) < 0.5 && Math.abs(prev.width - b.width) < 0.5 ? prev : b));
    setShown(true);
  };
  const reduced = prefersReducedMotion();
  return (
    <nav ref={ref} className={cn('relative', className)} onMouseMove={onMove} onMouseLeave={() => setShown(false)} data-os-nav>
      {box && (
        <motion.span aria-hidden className="pointer-events-none absolute z-0 nav-hover nav-pill"
          initial={false}
          animate={{ top: box.top, left: box.left, width: box.width, height: box.height, opacity: shown ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { top: GLIDE, left: GLIDE, width: GLIDE, height: GLIDE, opacity: { duration: D.INSTANT, ease: E.STANDARD } }} />
      )}
      {children}
    </nav>
  );
}

// ProfileMenu — the one account menu of the OS, at the bottom-left of every shell (sidebar foot, rail foot, mobile drawer), the way Pucho's
// own apps do it (Haresh review Oct 2026, UI 1–3). Opens upward: Profile & settings (one page) · Sign out. The header carries no avatar.
export function ProfileMenu({ wide = true, compact = false, onNavigate }) {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const t = useT();
  const [open, setOpen] = useState(false); const ref = useRef(null);
  useEffect(() => {
    const on = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', on); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', on); document.removeEventListener('keydown', esc); };
  }, []);
  const settings = NAV.find((n) => n.kind === 'settings');
  const go = (path) => { setOpen(false); onNavigate?.(); navigate(path); };
  return (
    <div ref={ref} className={cn('relative', compact ? 'flex justify-center' : 'w-full')}>
      <button type="button" onClick={() => setOpen(!open)} aria-label="Account menu" aria-haspopup="menu" aria-expanded={open} data-os-avatar-menu
        className={cn('no-pill nav-row flex items-center gap-3 text-left transition-colors', compact ? 'w-10 h-10 justify-center !p-0' : 'w-full px-2 h-12', wide && !compact ? '' : 'justify-center')}>
        <ProfileAvatar size={compact ? 30 : 34} editable={false} />
        {wide && !compact && <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium truncate" style={{ color: 'var(--nav-ink)' }}>{user?.name}</span><span className="block text-[12px] font-medium truncate" style={{ color: 'var(--nav-group)' }}>{ROLE_LABELS[user?.role]}</span></span>}
      </button>
      {open && (
        <div role="menu" className={cn('absolute bottom-full mb-2 w-[220px] bg-white rounded-[var(--r-10)] shadow-overlay border border-surface-border z-50 overflow-hidden py-1', compact ? 'left-0' : 'left-0')} data-os-popover>
          <div className="px-3 py-2 border-b border-surface-border"><p className="text-[13px] font-medium text-ink truncate">{user?.name}</p><p className="text-[12px] text-ink-3 truncate">{user?.email ?? ROLE_LABELS[user?.role]}</p></div>
          {settings && <button role="menuitem" className="no-pill w-full text-left px-3 py-2 text-[13px] text-ink-2 hover:bg-black/[0.03] flex items-center gap-2" onClick={() => go(settings.path)}><UserRound className="w-4 h-4 text-ink-3" /> {t('Profile & settings')}</button>}
          <button role="menuitem" className="no-pill w-full text-left px-3 py-2 text-[13px] text-bad-text hover:bg-bad-soft flex items-center gap-2 border-t border-surface-border mt-1" onClick={() => { setOpen(false); onNavigate?.(); logout(); navigate('/login'); }} data-os-signout><LogOut className="w-4 h-4" /> {t('Sign out')}</button>
        </div>
      )}
    </div>
  );
}

const isActive = (path, pathname) => pathname === path || (path !== '/' && pathname.startsWith(path + '/'));
const Ico = (name) => Icons[name] || Icons.Circle;

/** Live counts for nav items that declare `badge: { entity, where }`. */
function useNavBadges(items, user) {
  const specs = items.filter((n) => n.badge && typeof n.badge === 'object' && n.badge.entity);
  const names = useMemo(() => [...new Set(specs.map((n) => n.badge.entity))], [specs.map((n) => n.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data } = useEntities(names);
  return useMemo(() => Object.fromEntries(specs.map((n) => [n.id, where(data[n.badge.entity] ?? [], n.badge.where, user).length])), [data, names, user]); // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Sidebar({ expanded, mobileOpen, onToggle, onClose }) {
  const location = useLocation(); const { user } = useAuth();
  const portal = portalFor(location.pathname);
  const shell = shellFor(portal.id); const t = useT();
  const sb = DESIGN.sidebar ?? {};
  const dark = (DESIGN.sidebar_styles?.[portal.id] ?? sb.style) === 'dark';
  const [open, setOpen] = useState({});
  const perms = ROLE_PERMISSIONS[user?.role] || [];
  const allowed = (n) => !n.hidden && (perms.includes('*') || perms.includes(n.id));
  const items = useMemo(() => NAV.filter((n) => n.portal === portal.id && !n.parent && allowed(n)), [user, portal.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const children = (id) => NAV.filter((n) => n.parent === id && allowed(n));
  const badges = useNavBadges(NAV.filter((n) => n.portal === portal.id && allowed(n)), user);
  // groups in declaration order; settings always last, in its own unlabelled group
  const groups = useMemo(() => { const g = new Map(); for (const it of items.filter((x) => x.kind !== 'settings')) { const k = it.group ?? ''; if (!g.has(k)) g.set(k, []); g.get(k).push(it); } return [...g.entries()]; }, [items]);  // settings is in the avatar menu, not the rail
  const otherPortals = PORTALS.filter((p) => p.id !== portal.id && (perms.includes('*') || p.roles.includes(user?.role)));
  const actionPage = sb.action ? NAV.find((n) => n.id === sb.action.page) : null;
  const action = sb.action && actionPage && actionPage.portal === portal.id && allowed(actionPage) ? sb.action : null;   // only on the portal its page belongs to
  const actionTo = action ? `${NAV.find((n) => n.id === action.page)?.path ?? portal.base}${action.modal ? `?action=${action.modal}` : ''}` : null;

  // The mobile drawer closes on Escape and locks the page behind it (audit L4).
  useEffect(() => {
    if (!mobileOpen) return;
    const on = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', on); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', on); document.body.style.overflow = prev; };
  }, [mobileOpen, onClose]);
  const staticBadge = (item) => (typeof item.badge === 'string' ? <span className="badge badge-info ml-auto">{item.badge}</span> : null);
  const Badge = ({ id }) => (badges[id] > 0 ? <span className="nav-badge ml-auto" data-os-nav-badge={id}>{badges[id]}</span> : null);
  const link = (item, group, depth = 0, wide = expanded) => {
    const active = isActive(item.path, location.pathname); const I = Ico(item.icon);
    return (
      <Link key={item.id} to={item.path} onClick={onClose} data-nav-item={item.id} data-active={active ? 'true' : undefined} aria-current={active ? 'page' : undefined} title={wide ? undefined : t(item.label)}
        className={cn('nav-row relative isolate flex items-center gap-3 text-[13px] font-medium transition-[color] duration-150 ease-out', wide ? (depth ? 'pl-9 pr-3' : 'px-3') : 'justify-center w-11 lg:w-9 mx-auto')}>
        {/* The active pill is neutral; the 3px brand marker on its left edge is the one place the brand colour appears in the chrome. */}
        {active && <motion.span layoutId={`nav-pill-${group}`} aria-hidden className="-z-10 absolute inset-0 nav-pill overflow-hidden" transition={prefersReducedMotion() ? { duration: 0 } : GLIDE}><span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-brand-500" data-os-nav-marker /></motion.span>}
        <I className={cn('shrink-0', depth ? 'w-4 h-4' : 'w-[18px] h-[18px]', active ? 'opacity-100' : 'opacity-70')} strokeWidth={1.75} />
        {wide && <span className="truncate">{t(item.label)}</span>}
        {wide && <Badge id={item.id} />}{wide && staticBadge(item)}
      </Link>
    );
  };
  const groupBlock = (label, its, group, wide = expanded) => (
    <div key={label} className="mb-2">
      {label && wide && <p className="nav-group px-3 pt-3 pb-1 text-[12px] font-medium">{t(label)}</p>}
      {its.map((item) => { const kids = children(item.id); if (!kids.length) return link(item, group, 0, wide);
        const parentActive = isActive(item.path, location.pathname) || kids.some((k) => isActive(k.path, location.pathname)); const isOpen = open[item.id] ?? parentActive; const I = Ico(item.icon);
        return (
          <div key={item.id}>
            <button onClick={() => setOpen({ ...open, [item.id]: !isOpen })} data-nav-item={item.id} className={cn('nav-row relative isolate w-full flex items-center gap-3 text-[13px] font-medium transition-[color] duration-150', wide ? 'px-3' : 'justify-center w-11 lg:w-9 mx-auto', parentActive && 'nav-row-active')}>
              <I className="w-[18px] h-[18px] shrink-0 opacity-80" strokeWidth={1.75} />{wide && <><span className="flex-1 text-left truncate">{t(item.label)}</span><Badge id={item.id} /><Icons.ChevronDown className={cn('w-4 h-4 opacity-60 transition-transform', isOpen && 'rotate-180')} /></>}
            </button>
            {isOpen && wide && <div className="nav-line mt-0.5 space-y-0.5 border-l ml-5 pl-1">{kids.map((k) => link(k, group, 1, wide))}</div>}
          </div>);
      })}
    </div>
  );
  const head = (wide) => (
    <div className={cn('nav-line flex items-center border-b h-[56px] shrink-0', wide ? 'px-4 gap-2.5' : 'justify-center')}>
      <BrandMark size={28} wordmark={wide} onDark={dark} sub={wide && PORTALS.length > 1 ? portal.label : undefined} />
      <button onClick={onClose} aria-label="Close menu" className="lg:hidden absolute top-1.5 right-1.5 w-11 h-11 flex items-center justify-center rounded-lg"><Icons.X className="w-5 h-5 opacity-60" /></button>
    </div>
  );
  const actionRow = (wide) => action && (
    <div className={cn('pt-3', wide ? 'px-3' : 'px-2 flex justify-center')}>
      <Link to={actionTo} onClick={onClose} data-os-nav-action={action.modal ?? action.page} title={action.label}
        className={cn('btn-primary', wide ? 'w-full h-9 !py-0 text-[13px]' : 'w-9 h-9 !p-0')}>
        <Icons.Plus className="w-4 h-4" />{wide && <span className="truncate">{t(action.label)}</span>}
      </Link>
    </div>
  );
  const foot = (wide) => (
    <>
      {otherPortals.length > 0 && wide && <div className="px-3 pb-2">{otherPortals.map((p) => <Link key={p.id} to={p.base} className="nav-row flex items-center gap-2 px-3 text-xs font-medium"><Icons.ArrowLeftRight className="w-4 h-4" /> {t('Switch to')} {t(p.label)}</Link>)}</div>}
      {shell === 'sidebar' && <button onClick={onToggle} aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'} className="nav-row hidden lg:flex items-center justify-center mx-3 mb-2"><Icons.ChevronLeft className={cn('w-4 h-4 transition-transform', !expanded && 'rotate-180')} /></button>}
      <div className={cn('nav-line p-2 border-t', !wide && 'flex flex-col items-center')}>
        <ProfileMenu wide={wide} compact={!wide} onNavigate={onClose} />
      </div>
    </>
  );

  // ── shell: sidebar ──────────────────────────────────────────────────────────────────────
  const sidebarBody = (group) => (
    <>
      {head(expanded)}
      {actionRow(expanded)}
      <HoverNav className={cn('flex-1 py-3 overflow-y-auto custom-scrollbar space-y-0.5', expanded ? 'px-3' : 'px-2')}>
        <LayoutGroup id={group}>{groups.map(([label, its]) => groupBlock(label, its, group))}</LayoutGroup>
      </HoverNav>
      {foot(expanded)}
    </>
  );

  // ── shell: rail ─────────────────────────────────────────────────────────────────────────
  // Sections = the sidebar groups (an ungrouped page is its own section). The rail shows one icon per
  // section; the panel lists the pages of the selected section. Selecting follows the route, or a click.
  const sections = useMemo(() => groups.flatMap(([label, its]) => label ? [{ id: `g:${label}`, label, icon: its[0]?.icon, items: its }] : its.map((it) => ({ id: it.id, label: it.label, icon: it.icon, items: [it], single: true }))), [groups]);
  const activeSection = sections.find((s) => s.items.some((it) => isActive(it.path, location.pathname) || children(it.id).some((k) => isActive(k.path, location.pathname))));
  const [pick, setPick] = useState(null);
  const current = sections.find((s) => s.id === pick) ?? activeSection ?? sections[0];
  const panelOpen = !!current && !(current.single && !children(current.items[0].id).length);
  const railBody = (group) => (
    <div className="flex h-full">
      <div className="nav-line flex flex-col items-center border-r shrink-0" style={{ width: 'var(--rail-w)' }} data-os-iconrail>
        <div className="nav-line h-[56px] flex items-center justify-center border-b w-full"><BrandMark size={30} wordmark={false} onDark={dark} /></div>
        {actionRow(false)}
        <nav className="flex-1 w-full py-3 flex flex-col items-center gap-1 overflow-y-auto custom-scrollbar" aria-label="Sections">
          {sections.map((s) => { const I = Ico(s.icon); const on = current?.id === s.id; const single = s.single && !children(s.items[0].id).length; const count = s.items.reduce((a, it) => a + (badges[it.id] ?? 0) + children(it.id).reduce((b, k) => b + (badges[k.id] ?? 0), 0), 0);
            const cls = cn('nav-row relative w-11 h-11 !rounded-xl flex flex-col items-center justify-center gap-0.5', on && 'nav-row-active');
            const inner = <><span className={cn('absolute inset-0 -z-10 nav-pill !rounded-xl', on ? 'opacity-100' : 'opacity-0')} aria-hidden /><I className="w-5 h-5" strokeWidth={1.75} />{count > 0 && <span className="nav-badge absolute -top-1 -right-1" data-os-nav-badge={s.id}>{count}</span>}</>;
            return single
              ? <Link key={s.id} to={s.items[0].path} onClick={() => { setPick(s.id); onClose?.(); }} title={s.label} data-os-rail-item={s.id} data-active={on ? 'true' : undefined} className={cn(cls, 'isolate')}>{inner}</Link>
              : <button key={s.id} type="button" onClick={() => setPick(s.id)} title={s.label} data-os-rail-item={s.id} data-active={on ? 'true' : undefined} aria-expanded={on} className={cn(cls, 'isolate')}>{inner}</button>; })}
        </nav>
        <div className="nav-line w-full border-t p-2 flex flex-col items-center gap-1">
          {otherPortals.map((p) => <Link key={p.id} to={p.base} title={`Switch to ${p.label}`} className="nav-row w-9 h-9 flex items-center justify-center"><Icons.ArrowLeftRight className="w-4 h-4" /></Link>)}
          <ProfileMenu compact />
        </div>
      </div>
      {panelOpen && (
        <div className="flex-1 min-w-0 flex flex-col" data-os-rail-panel={current.id}>
          <div className="nav-line h-[56px] flex items-center px-4 border-b gap-2">
            <div className="min-w-0"><p className="text-[13px] font-semibold truncate" style={{ color: 'var(--nav-ink)' }}>{t(current.label)}</p>{PORTALS.length > 1 && <p className="text-[12px] font-medium uppercase tracking-wide truncate" style={{ color: 'var(--nav-group)' }}>{portal.label}</p>}</div>
          </div>
          <HoverNav className="flex-1 py-3 px-3 overflow-y-auto custom-scrollbar space-y-0.5">
            <LayoutGroup id={group}>{groupBlock('', current.items, group, true)}</LayoutGroup>
          </HoverNav>
        </div>
      )}
    </div>
  );

  const railWidth = panelOpen ? 'calc(var(--rail-w) + var(--nav-w))' : 'var(--rail-w)';
  const mobileBody = () => (
    <>{head(true)}{actionRow(true)}
      <HoverNav className="flex-1 py-3 px-3 overflow-y-auto custom-scrollbar space-y-0.5"><LayoutGroup id="mobile">{groups.map(([label, its]) => groupBlock(label, its, 'mobile', true))}</LayoutGroup></HoverNav>
      {foot(true)}</>
  );
  return (
    <>
      {shell === 'rail'
        ? <aside className="nav-shell hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r transition-[width] duration-300" style={{ width: railWidth }} data-os-shell="rail" data-os-shell-open={panelOpen ? 'true' : 'false'}>{railBody('desktop')}</aside>
        : <aside className="nav-shell hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r transition-[width] duration-300" style={{ width: expanded ? 'var(--nav-w)' : '68px' }} data-os-shell="sidebar">{sidebarBody('desktop')}</aside>}
      {mobileOpen && <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Menu"><div className="absolute inset-0 bg-black/30" onClick={onClose} /><aside className="nav-shell absolute inset-y-0 left-0 w-[268px] flex flex-col shadow-2xl" data-os-shell="mobile">{mobileBody()}</aside></div>}
    </>
  );
}
