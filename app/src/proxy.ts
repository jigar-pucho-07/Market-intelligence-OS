// src/proxy.ts — Next 16's name for the request hook (`middleware.ts` is deprecated and warns on every build — Haresh review,
// Oct 2026). A convenience, not authorization (standards §19.3, CVE-2025-29927): signed-out visitors are sent to /login early
// and plain-http requests to an https origin are redirected. Every page and action still checks the
// session itself. Public pages (`public: true` in os.yaml) and the API pass through.
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/routes';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = process.env.APP_ORIGIN || '';
  if (origin.startsWith('https://') && req.headers.get('x-forwarded-proto') === 'http') {
    const url = req.nextUrl.clone(); url.protocol = 'https:'; return NextResponse.redirect(url, 308);
  }
  if (pathname.startsWith('/api/') || pathname === '/login' || isPublicPath(pathname)) return NextResponse.next();
  const cookie = origin.startsWith('https://') ? '__Host-session' : 'session';
  if (!req.cookies.get(cookie)?.value) {
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
// download.webp is the "Powered by" mark: a public page (and the sign-in page) shows it to signed-out visitors.
export const config = { matcher: ['/((?!_next/|brand/|data/|manifest\\.webmanifest|sw\\.js|favicon|download\\.webp).*)'] };
