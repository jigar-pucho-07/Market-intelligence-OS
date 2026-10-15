// src/lib/fileLinks.ts — short-lived signed links so a workflow can fetch ONE upload without a session (D6, §19.4).
// /api/files/<id> serves signed-in people only. A flow (OCR, a WhatsApp attachment) has no session, so when the app
// calls a wired flow it rewrites each `/api/files/F-…` value in the payload to an absolute URL carrying `exp` and an
// HMAC over `<id>.<exp>` keyed by AUTH_PEPPER. The link names one file, expires in 15 minutes, and cannot be widened.
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_S = 15 * 60;
const FILE_PATH = /^\/api\/files\/(F-[0-9a-f]{16})$/;
const key = () => process.env.AUTH_PEPPER || '';
const mac = (id: string, exp: number) => createHmac('sha256', `files:${key()}`).update(`${id}.${exp}`).digest('base64url');

export function signFileUrl(id: string, now = Date.now()): string | null {
  const origin = (process.env.APP_ORIGIN || '').replace(/\/+$/, '');
  if (!key() || !/^https?:\/\//.test(origin)) return null;           // no key or no public origin → no link (never a guessable one)
  const exp = Math.floor(now / 1000) + TTL_S;
  return `${origin}/api/files/${id}?exp=${exp}&sig=${mac(id, exp)}`;
}

export function verifyFileSig(id: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!key() || !exp || !sig || !/^\d{9,11}$/.test(exp)) return false;
  if (Number(exp) < Math.floor(now / 1000) || Number(exp) > Math.floor(now / 1000) + TTL_S + 60) return false;
  const want = Buffer.from(mac(id, Number(exp))); const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Rewrite every `/api/files/F-…` string in a flow payload to a signed absolute link. Returns the unsigned ones it could not sign. */
export function signPayloadFiles(payload: Record<string, unknown>): { payload: Record<string, unknown>; unsigned: string[] } {
  const unsigned: string[] = []; const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    const m = typeof v === 'string' ? v.match(FILE_PATH) : null;
    if (!m) { out[k] = v; continue; }
    const url = signFileUrl(m[1]); if (url) out[k] = url; else { out[k] = v; unsigned.push(k); }
  }
  return { payload: out, unsigned };
}
