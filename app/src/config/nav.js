// src/config/nav.js — generated from os.yaml portals[] + pages[]. ONE place: sidebar (with groups/children), header title/description, quick links, guards.
export const PORTALS = [{"id": "desk", "label": "Market Desk", "base": "/", "roles": ["admin", "analyst"]}, {"id": "reader", "label": "My Reports", "base": "/me", "roles": ["subscriber"]}];
export const NAV = [
  {
    "id": "overview",
    "portal": "desk",
    "path": "/",
    "label": "Overview",
    "icon": "LayoutDashboard",
    "desc": "The month's numbers and charts first, then this morning's exceptions",
    "kind": "overview",
    "subtitle": "How the reports are landing, then what needs a person this morning"
  },
  {
    "id": "today",
    "portal": "desk",
    "path": "/today",
    "label": "Today's report",
    "icon": "Sunrise",
    "desc": "The 6 AM report as subscribers will read it, with review, send and re-run",
    "subtitle": "Check this morning's view, change it if needed, and send it before the open"
  },
  {
    "id": "reports",
    "portal": "desk",
    "path": "/reports",
    "label": "Reports",
    "icon": "FileText",
    "desc": "Every daily report, its views and who received it",
    "subtitle": "Every daily report — open one to see its views, its news and its deliveries"
  },
  {
    "id": "news",
    "portal": "desk",
    "path": "/news",
    "label": "News feed",
    "icon": "Newspaper",
    "desc": "Every article the runs analysed, by category, impact and source",
    "subtitle": "The news behind each report — filter by category, impact or source"
  },
  {
    "id": "pipeline",
    "portal": "desk",
    "path": "/pipeline",
    "label": "Pipeline",
    "icon": "Workflow",
    "desc": "The workflow steps, its configuration and every run with its source counts and errors",
    "subtitle": "How the 6 AM run is wired, and every run — re-run the ones that failed"
  },
  {
    "id": "subscribers",
    "portal": "desk",
    "path": "/subscribers",
    "label": "Subscribers",
    "icon": "Users",
    "desc": "Who receives the report by email",
    "subtitle": "Add, pause or remove subscribers — only people who opted in"
  },
  {
    "id": "deliveries",
    "portal": "desk",
    "path": "/deliveries",
    "label": "Deliveries",
    "icon": "MessageSquare",
    "desc": "Every WhatsApp sent, with its status — retry the failed ones",
    "subtitle": "Every WhatsApp the desk sent — retry a failed delivery"
  },
  {
    "id": "activity",
    "portal": "desk",
    "path": "/activity",
    "label": "Activity",
    "icon": "History",
    "desc": "Every change by a person or a flow",
    "group": "Setup",
    "kind": "page"
  },
  {
    "id": "me_today",
    "portal": "reader",
    "path": "/me",
    "label": "Today's report",
    "icon": "Sunrise",
    "desc": "This morning's report, as sent on WhatsApp, in full",
    "subtitle": "This morning's market outlook — read it before the 9:15 AM open"
  },
  {
    "id": "me_reports",
    "portal": "reader",
    "path": "/me/reports",
    "label": "Past reports",
    "icon": "FileText",
    "desc": "Every report that was sent",
    "subtitle": "Every report that was sent — open one to read it again or print it"
  },
  {
    "id": "users",
    "portal": "desk",
    "path": "/users",
    "label": "Users & roles",
    "icon": "Users",
    "desc": "Everyone who can sign in, and what each role may open",
    "group": "Setup",
    "kind": "users",
    "subtitle": "Add people, reset passwords, change roles"
  },
  {
    "id": "settings",
    "portal": "desk",
    "path": "/settings",
    "label": "Settings",
    "icon": "Settings",
    "desc": "Profile, password and theme",
    "kind": "settings"
  }
];
export function portalFor(pathname) {
  return [...PORTALS].sort((a, b) => b.base.length - a.base.length).find((p) => pathname === p.base || pathname.startsWith(p.base === '/' ? '/' : p.base + '/')) ?? PORTALS[0];
}
export function navFor(portalId) { return NAV.filter((n) => n.portal === portalId); }
export function metaForPath(pathname) {
  const hit = [...NAV].sort((a, b) => b.path.length - a.path.length).find((n) => pathname === n.path || (n.path !== '/' && pathname.startsWith(n.path + '/')));
  return hit ?? { label: 'Market Intelligence', desc: '' };
}
