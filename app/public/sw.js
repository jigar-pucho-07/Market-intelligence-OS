// Service worker — the OS installs to a phone's home screen and opens instantly on a bad connection.
// Strategy: hashed /_next/static/* are immutable → cache-first; a navigation is network-first and, offline, falls back
// to the last page the shell cached; /api/* (data, files, health) is never cached — a stale record is worse than a spinner.
// Server-rendered pages carry the signed-in person's rows, so nothing but the shell's own route is kept, and only for them.
const VERSION = 'os-shell-v4';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(VERSION)); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/brand/')) {
    e.respondWith(caches.open(VERSION).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) caches.open(VERSION).then((c) => c.put('/__offline', r.clone())); return r; }).catch(() => caches.match('/__offline')));
  }
});
