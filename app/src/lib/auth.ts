// src/lib/auth.ts — passwords, sessions, one-time codes (standards §7, §19.2). The browser holds one opaque token in an
// HttpOnly cookie; the server holds its SHA-256 and can revoke it. Nothing session-related ever touches localStorage.
import 'server-only';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { hash, verify } from '@node-rs/argon2';
import { query } from './db';

// ── demo logins (was src/lib/demo.ts) — the one reading of DEMO_LOGINS (audit S3 / S4, Oct 2026).
//   unset / anything else  → no demo picker, no persona sign-in (every client deployment)
//   true                   → demo logins on a LOCAL or demo database only: the server refuses to start when the portal's
//                            DB_* block is present (instrumentation-node.ts), so a forgotten flag cannot open a live app
//   portal-demo            → the deliberate exception: a demo deployment on CP Portal for the step-5 click-through,
//                            holding demo data only. Said out loud in the start-up log and in /api/health (admin).
export const DEMO_MODES = ['true', 'portal-demo'] as const;
export const demoLogins = () => (DEMO_MODES as readonly string[]).includes(process.env.DEMO_LOGINS ?? '');
export const demoMode = () => (demoLogins() ? (process.env.DEMO_LOGINS as (typeof DEMO_MODES)[number]) : null);

const ARGON = { memoryCost: 19456, timeCost: 2, parallelism: 1 };            // OWASP minimum; every hash starts $argon2id$
const SESSION_DAYS = 30;
const OTP_MINUTES = 10; const OTP_ATTEMPTS = 5;
const SIGNIN_WINDOW_MIN = 15; const SIGNIN_MAX = 10;

export const secureOrigin = () => (process.env.APP_ORIGIN || '').startsWith('https://');
// `__Host-` needs Secure + Path=/ + no Domain; the browser refuses it over plain http, so a local http origin uses the plain name.
export const SESSION_COOKIE = secureOrigin() ? '__Host-session' : 'session';

export type SessionUser = { id: string; email: string; name: string; role: string; mustChangePassword: boolean };

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const hashPassword = (pw: string) => hash(pw, ARGON);
export const checkPassword = (stored: string, pw: string) => verify(stored, pw).catch(() => false);
// A fixed hash for unknown accounts, so the timing of "no such user" matches "wrong password" (§19.2).
let DUMMY: string | null = null;
async function dummyVerify(pw: string) { DUMMY ??= await hashPassword(randomBytes(16).toString('hex')); await verify(DUMMY, pw).catch(() => false); }

export function newId(prefix = 'USR') { return `${prefix}-${randomBytes(6).toString('hex').toUpperCase()}`; }

// ── rate limit (§19.2): failures per account and per address inside a fixed window; a success clears the account's count ──
export async function rateLimited(key: string, max = SIGNIN_MAX, windowMin = SIGNIN_WINDOW_MIN): Promise<boolean> {
  const rows = await query<{ count: number }>(`SELECT count FROM signin_attempts WHERE key = $1 AND window_start > now() - ($2 || ' minutes')::interval`, [key, String(windowMin)]);
  return (rows[0]?.count ?? 0) >= max;
}
export async function recordFailure(key: string, windowMin = SIGNIN_WINDOW_MIN): Promise<void> {
  await query(
    `INSERT INTO signin_attempts (key, count, window_start) VALUES ($1, 1, now())
     ON CONFLICT (key) DO UPDATE SET count = CASE WHEN signin_attempts.window_start < now() - ($2 || ' minutes')::interval THEN 1 ELSE signin_attempts.count + 1 END,
                                   window_start = CASE WHEN signin_attempts.window_start < now() - ($2 || ' minutes')::interval THEN now() ELSE signin_attempts.window_start END`, [key, String(windowMin)]);
}
export async function clearRate(key: string) { await query('DELETE FROM signin_attempts WHERE key = $1', [key]); }

/** The client's network address for the per-address rate limit — only as far as it can be trusted (audit S5).
 *  X-Forwarded-For is a list the client starts and each proxy appends to, so its first value is the client's own claim. With
 *  TRUST_PROXY_HOPS=n (the proxies in front of this process, 1 behind CP Portal) the address is the one n hops from the right,
 *  which the last trusted proxy wrote. Without it this process cannot see a socket address from a Server Action, so the
 *  per-address limit does not apply (null) and only the per-account limit counts — honest, rather than a limit any client can
 *  reset by editing a header. */
export async function clientAddress(): Promise<string | null> {
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (!Number.isFinite(hops) || hops < 1) return null;
  const h = await headers();
  const chain = (h.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return chain.length >= hops ? chain[chain.length - hops] : null;
}
const addrKey = (prefix: string, addr: string | null) => (addr ? `${prefix}:${addr}` : null);
async function limitedBy(key: string | null, max?: number, windowMin?: number) { return key ? rateLimited(key, max, windowMin) : false; }
async function failed(key: string | null, windowMin?: number) { if (key) await recordFailure(key, windowMin); }

// ── sessions ──
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const ua = (await headers()).get('user-agent')?.slice(0, 200) ?? null;
  await query('INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, now() + ($3 || \' days\')::interval, $4)', [sha256(token), userId, String(SESSION_DAYS), ua]);
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: secureOrigin(), sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * SESSION_DAYS });
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await query<{ id: string; email: string; name: string; role: string; must_change_password: boolean }>(
    `UPDATE sessions s SET last_seen_at = now()
       FROM users u WHERE s.token_hash = $1 AND s.user_id = u.id AND s.expires_at > now() AND u.is_active
     RETURNING u.id, u.email, u.name, u.role, u.must_change_password`, [sha256(token)]);
  const u = rows[0];
  return u ? { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password } : null;
}

export async function destroySession(): Promise<void> {
  const c = await cookies(); const token = c.get(SESSION_COOKIE)?.value;
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  c.delete(SESSION_COOKIE);
}
/** Deactivation, password change and reset end every session of that person (§19.2). */
export async function revokeSessions(userId: string) { await query('DELETE FROM sessions WHERE user_id = $1', [userId]); }

// ── password sign-in ──
export async function signInWithPassword(email: string, password: string): Promise<{ ok: true; user: SessionUser } | { ok: false; message: string }> {
  const ip = addrKey('ip', await clientAddress()); const e = email.trim().toLowerCase();
  if (await limitedBy(ip, SIGNIN_MAX * 3) || await rateLimited(`acct:${e}`)) return { ok: false, message: 'Too many attempts — try again in a few minutes' };
  const rows = await query<{ id: string; email: string; name: string; role: string; password_hash: string | null; must_change_password: boolean; is_active: boolean }>(
    'SELECT id, email, name, role, password_hash, must_change_password, is_active FROM users WHERE email = $1', [e]);
  const u = rows[0];
  const fail = async () => { await failed(ip); await recordFailure(`acct:${e}`); return { ok: false as const, message: 'Invalid credentials' }; };
  if (!u || !u.password_hash || !u.is_active) { await dummyVerify(password); return fail(); }
  if (!(await checkPassword(u.password_hash, password))) return fail();
  await clearRate(`acct:${e}`);
  await createSession(u.id);
  return { ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password } };
}

/** The demo picker's sign-in (audit S3): a seeded persona by role, from db/seed/users.json on disk, only while the server runs
 *  with DEMO_LOGINS=true. No password crosses the wire; the session is created here like any other. */
export async function signInAsSeededPersona(role: string): Promise<{ ok: true; user: SessionUser } | { ok: false; message: string }> {
  if (!demoLogins()) return { ok: false, message: 'Demo sign-in is not available on this deployment' };
  let email: string | undefined;
  try {
    const { readFileSync } = await import('node:fs'); const { join } = await import('node:path');
    const users = JSON.parse(readFileSync(join(process.cwd(), 'db', 'seed', 'users.json'), 'utf8')) as { role: string; email: string }[];
    email = users.find((x) => x.role === role)?.email?.toLowerCase();
  } catch { email = undefined; }
  if (!email) return { ok: false, message: 'No such demo persona' };
  const rows = await query<{ id: string; email: string; name: string; role: string; must_change_password: boolean }>('SELECT id, email, name, role, must_change_password FROM users WHERE email = $1 AND is_active', [email]);
  const u = rows[0];
  if (!u) return { ok: false, message: 'That persona is not seeded on this database (npm run db:seed on a demo database)' };
  await createSession(u.id);
  return { ok: true, user: { id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.must_change_password } };
}

// ── one-time codes (§7): the server generates, hashes, limits and compares; a workflow only delivers ──
function codeHash(email: string, code: string) {
  const pepper = process.env.AUTH_PEPPER || '';
  return createHmac('sha256', pepper).update(`${email.toLowerCase()}:${code}`).digest('hex');
}
/** Returns the code to deliver, or null when the address is not an active account — the caller answers identically either way. */
export async function issueCode(email: string): Promise<string | null> {
  const e = email.trim().toLowerCase(); const ip = addrKey('otpip', await clientAddress());
  if (await rateLimited(`otp:${e}`, 5, 15) || await limitedBy(ip, 20, 15)) return null;
  await recordFailure(`otp:${e}`); await failed(ip);   // every request counts: codes are a mail cost
  const rows = await query<{ id: string }>('SELECT id FROM users WHERE email = $1 AND is_active', [e]);
  if (!rows[0]) return null;
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await query(`INSERT INTO otp_codes (email, code_hash, expires_at, attempts) VALUES ($1, $2, now() + ($3 || ' minutes')::interval, 0)
               ON CONFLICT (email) DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = now()`, [e, codeHash(e, code), String(OTP_MINUTES)]);
  return code;
}
export async function redeemCode(email: string, code: string): Promise<{ ok: true; user: SessionUser } | { ok: false; message: string }> {
  const e = email.trim().toLowerCase();
  const rows = await query<{ code_hash: string; expires_at: Date; attempts: number }>('SELECT code_hash, expires_at, attempts FROM otp_codes WHERE email = $1', [e]);
  const r = rows[0];
  if (!r || r.expires_at < new Date() || r.attempts >= OTP_ATTEMPTS) return { ok: false, message: 'That code is not valid any more — request a new one' };
  await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE email = $1', [e]);
  const a = Buffer.from(r.code_hash, 'hex'); const b = Buffer.from(codeHash(e, code.trim()), 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, message: 'Wrong code' };
  await query('DELETE FROM otp_codes WHERE email = $1', [e]);                   // single use
  const us = await query<{ id: string; email: string; name: string; role: string; must_change_password: boolean }>('SELECT id, email, name, role, must_change_password FROM users WHERE email = $1 AND is_active', [e]);
  if (!us[0]) return { ok: false, message: 'Invalid credentials' };
  await createSession(us[0].id);
  return { ok: true, user: { id: us[0].id, email: us[0].email, name: us[0].name, role: us[0].role, mustChangePassword: us[0].must_change_password } };
}

/** A Route Handler that mutates with the session cookie must also see the app's own Origin (§19.2 CSRF). */
export function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin'); if (!origin) return true;      // same-origin fetches may omit it; cross-site browsers send it
  const app = process.env.APP_ORIGIN; if (!app) return false;
  try { return new URL(origin).origin === new URL(app).origin; } catch { return false; }
}

/** Flows and other non-React callers present an inbound token; unset means closed (§14.6). Tokens (audit S8, Oct 2026):
 *    INBOUND_TOKEN            the shared token every flow may present
 *    INBOUND_TOKEN_<FLOW>     one token per flow (the CHECKLIST names it) — a leaked token points at one flow, and one flow can be cut off
 *    INBOUND_TOKEN_NEXT       the incoming token during a rotation: set it, move the flows over, then make it INBOUND_TOKEN and unset NEXT
 *  Returns the NAME of the variable that matched (written to the audit row), or null. */
export function inboundToken(req: Request): string | null {
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || req.headers.get('x-inbound-token') || '';
  if (!got) return null;
  const a = Buffer.from(got);
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || !(name === 'INBOUND_TOKEN' || name === 'INBOUND_TOKEN_NEXT' || name.startsWith('INBOUND_TOKEN_'))) continue;
    const b = Buffer.from(value);
    if (a.length === b.length && timingSafeEqual(a, b)) return name;
  }
  return null;
}
export const inboundOpen = () => Object.entries(process.env).some(([k, v]) => v && (k === 'INBOUND_TOKEN' || k.startsWith('INBOUND_TOKEN_')));
export function inboundAllowed(req: Request): boolean { return inboundToken(req) !== null; }

/** v4.9.0 · webhook signature verification (standards §19, security round). A provider that posts directly to this app
 *  (a payment/claim/KYC callback, not routed through Studio with an inbound token) proves it is genuine by signing the
 *  RAW request body with a shared secret. For provider `p`, the secret is `WEBHOOK_SECRET_<P>` (upper-cased, non-alnum →
 *  `_`); the request carries `sha256=<hex>` in `x-webhook-signature` (or `x-hub-signature-256`, GitHub/Stripe style). We
 *  recompute HMAC-SHA256 over the exact bytes received and compare in constant time. A provider with no secret set is
 *  CLOSED (unconfigured ≠ open). Returns the reason it failed (for the 401 body / audit) or null when the signature is good.
 *  The body must be the untouched raw text — never the re-serialized JSON, whose key order or spacing would change the digest. */
export function webhookSecretVar(provider: string): string { return 'WEBHOOK_SECRET_' + provider.toUpperCase().replace(/[^A-Z0-9]/g, '_'); }
export function verifyWebhookSignature(provider: string, rawBody: string, header: string | null): 'unconfigured' | 'missing' | 'mismatch' | null {
  const secret = process.env[webhookSecretVar(provider)];
  if (!secret) return 'unconfigured';
  const got = (header || '').trim().replace(/^sha256=/i, '');
  if (!got) return 'missing';
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(got.toLowerCase()); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? null : 'mismatch';
}

// ── the flow door's body (v4.7, security round: payload size and Content-Type) — one way to read a JSON request body on a Route Handler.
// `await req.json()` reads the whole body into memory first and asks questions later: a 50 MB body from a
// leaked token (or a mis-wired flow in a loop) is parsed before anyone checks it. Here the size is checked twice — the
// declared Content-Length, then the bytes as they stream in — and a body declared as something other than JSON is refused.
// A MISSING Content-Type is accepted (the emitter sets it on every http step; an older flow may not), a WRONG one is not.
//   const r = await readJson(req, JSON_MAX); if (!r.ok) return r.res; const body = r.body;
export const JSON_MAX = 256 * 1024;        // a flow's write: a row, a patch, a sync batch of a few hundred rows
export const JSON_MAX_SMALL = 64 * 1024;   // a job result
export const JSON_MAX_FILE = 4_500_000;    // /api/files: a base64 image under 3 MB plus its envelope

type Read = { ok: true; body: unknown } | { ok: false; res: Response };

export async function readJson(req: Request, max = JSON_MAX): Promise<Read> {
  const ct = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (ct && ct !== 'application/json') return { ok: false, res: Response.json({ error: 'Content-Type must be application/json' }, { status: 415 }) };
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > max) return { ok: false, res: tooBig(max) };
  if (!req.body) return { ok: false, res: Response.json({ error: 'body must be JSON' }, { status: 400 }) };
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel().catch(() => {}); return { ok: false, res: tooBig(max) }; }
    chunks.push(value);
  }
  try { return { ok: true, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; }
  catch { return { ok: false, res: Response.json({ error: 'body must be JSON' }, { status: 400 }) }; }
}

const tooBig = (max: number) => Response.json({ error: `body over ${Math.round(max / 1024)} KB` }, { status: 413 });
