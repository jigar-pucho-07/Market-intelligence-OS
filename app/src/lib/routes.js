// src/lib/routes.js — routes are data: every page and detail route comes from os.yaml through src/config/pages.js.
// Shared by proxy.ts (is this path public?), the catch-all Server Component (which page is this?) and the client
// router shim (which named params does this page's route pattern carry?). No secrets, no server-only import.
import { PAGES } from '@/config/pages';
import { ROLE_PERMISSIONS } from '@/config/roles';

function toRegex(pattern) {
  const keys = [];
  const src = pattern.replace(/\/+$/, '').replace(/:([A-Za-z_]\w*)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  return { re: new RegExp(`^${src || '/'}/?$`), keys };
}

const ROUTES = [];
for (const p of PAGES) {
  ROUTES.push({ page: p, kind: 'page', ...toRegex(p.route) });
  if (p.detail?.route) ROUTES.push({ page: p, kind: 'detail', ...toRegex(p.detail.route) });
}
ROUTES.sort((a, b) => b.re.source.length - a.re.source.length);   // the most specific pattern wins (/leads/:id before /leads)

/** { page, kind: 'page' | 'detail', params } for a pathname, or null. */
export function matchRoute(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  for (const r of ROUTES) {
    const m = r.re.exec(path);
    if (m) return { page: r.page, kind: r.kind, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}
export const isPublicPath = (pathname) => !!matchRoute(pathname)?.page.public;

/** Every entity a page reads: its own, every block's, every kpi/chart/section/lookup/options_from/badge it names. */
export function entitiesOf(page) {
  const out = new Set();
  const walk = (v) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(walk); return; }
    for (const [k, x] of Object.entries(v)) {
      if (k === 'entity' && typeof x === 'string') out.add(x);
      else if ((k === 'options_from' || k === 'rows_from') && typeof x === 'string') out.add(x.split('.')[0]);
      else if (k === 'from' && x && typeof x === 'object' && typeof x.entity === 'string') out.add(x.entity);
      else walk(x);
    }
  };
  walk(page);
  return [...out];
}

/** The role → pages map from os.yaml, checked on the server for every page and every action. */
export function permitted(role, pageId) {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes('*') || perms.includes(pageId);
}
