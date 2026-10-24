// src/lib/outLink.ts — 24 Oct 2026: where a stored web address really points. A Google News RSS link
// (news.google.com/rss/articles/<id>) is not the article: it opens a JavaScript page that asks Google for the publisher's
// address and then redirects — and in some browsers that request fails with a 400. Here the server asks Google once (the
// same two calls the page makes: the article page for its signature and timestamp, then batchexecute "garturlreq") and
// remembers the answer; every other address is returned unchanged. Only news.google.com is ever fetched (no SSRF), each
// call has a timeout, and anything unexpected (Google answers 429 when asked too often) falls back to the original link —
// the route then searches the headline instead.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const GN = /^https:\/\/news\.google\.com\/(?:rss\/)?(?:articles|read)\/([A-Za-z0-9_-]{20,})/;
const cache = new Map<string, string>();

/** The address as a URL, only when it is http(s). */
export function webUrl(v: unknown): URL | null {
  const s = String(v ?? '').trim(); if (!/^https?:\/\/\S+$/i.test(s)) return null;
  try { return new URL(s); } catch { return null; }
}
export const isGoogleNews = (v: unknown) => GN.test(String(v ?? '').trim());

async function fetchText(url: string, init: RequestInit = {}, ms = 8000): Promise<string> {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  try {
    const r = await fetch(url, { ...init, redirect: 'follow', signal: ac.signal, headers: { 'User-Agent': UA, ...(init.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`); return await r.text();
  } finally { clearTimeout(t); }
}

/** The publisher's address for a Google News link (cached); the link itself when it is not one or cannot be decoded. */
export async function resolveOutbound(link: string): Promise<string> {
  const m = link.trim().match(GN); if (!m) return link;
  const id = m[1]; const hit = cache.get(id); if (hit) return hit;
  try {
    const page = await fetchText(`https://news.google.com/articles/${id}?hl=en-IN&gl=IN&ceid=IN:en`);
    const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1]; const ts = page.match(/data-n-a-ts="(\d+)"/)?.[1];
    if (!sg || !ts) return link;
    const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg]);
    const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]));
    const res = await fetchText('https://news.google.com/_/DotsSplashUi/data/batchexecute', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
    const line = res.split('\n').find((l) => l.includes('garturlres')); if (!line) return link;
    const url = JSON.parse(JSON.parse(line)[0][2])[1];
    const out = webUrl(url); if (!out || out.hostname.endsWith('google.com')) return link;
    if (cache.size > 2000) cache.clear();
    cache.set(id, out.href); return out.href;
  } catch { return link; }
}
