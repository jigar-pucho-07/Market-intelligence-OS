'use server';
// src/app/actions.ts — every write from the browser (standards §15.2). Each action: 1. who is calling (requireUser),
// 2. what they sent (Zod, strict), 3. may they (the role → page/action map generated from os.yaml), then act through the
// DAL and refresh the page tree. A Server Action is a public HTTP endpoint — nothing here trusts the client's word.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { currentUser, signInWithPassword, signInAsSeededPersona, destroySession, issueCode, redeemCode, hashPassword, checkPassword, revokeSessions, newId, type SessionUser, demoLogins, rateLimited, recordFailure } from '@/lib/auth';
import { query } from '@/lib/db';
import { insertRows, patchRow, deleteRow, listRows, getRow, storeFile, writeAudit, type Actor, NotFound, Conflict, Invalid, InUse } from '@/lib/dal';
import { validateEntity, applyComputed, validateStage, needsCurrentRow } from '@/lib/validate';
import { runFlowAction, deliverCode, otpAvailable } from '@/lib/flows';
import { ENTITIES, OS, AUTH, FLOW_ACTIONS, LIMITS } from '@/config/os.config';
import { ACTIONS, PUBLIC_ACTIONS } from '@/config/access';
import { ROLES } from '@/config/roles';

type R<T = {}> = ({ ok: true } & T) | { ok: false; message: string };
const ROLE_KEYS = Object.values(ROLES as unknown as Record<string, string>) as [string, ...string[]];
const Email = z.string().trim().toLowerCase().email().max(120);
const Password = z.string().min(8, 'Use at least 8 characters').max(128);

async function requireUser(): Promise<SessionUser> {
  const u = await currentUser(); if (!u) throw new Error('Not signed in'); return u;
}
const dto = (u: SessionUser) => ({ id: u.id, email: u.email, name: u.name, role: u.role, mustChangePassword: u.mustChangePassword });

// ── sign-in ──
export async function signIn(input: unknown): Promise<R<{ user: ReturnType<typeof dto> }>> {
  const p = z.object({ email: Email, password: z.string().min(1).max(128) }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: 'Please enter email and password' };
  const r = await signInWithPassword(p.data.email, p.data.password);
  return r.ok ? { ok: true, user: dto(r.user) } : { ok: false, message: r.message };
}
export async function signOut(): Promise<R> { await destroySession(); return { ok: true }; }

/** The demo picker (step 5): sign in as a seeded persona without typing its password. Exists only while the server runs with
 *  DEMO_LOGINS=true — a demo deployment holds demo data and is, by design, open to whoever has its URL; the personas' passwords
 *  no longer travel to the browser for that (audit S3). On any other deployment this action refuses, whatever the client sends. */
export async function signInAsPersona(input: unknown): Promise<R<{ user: ReturnType<typeof dto> }>> {
  if (!demoLogins()) return { ok: false, message: 'Demo sign-in is not available on this deployment' };
  const p = z.object({ role: z.string().trim().min(1).max(40) }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: 'Pick a persona' };
  const r = await signInAsSeededPersona(p.data.role);
  return r.ok ? { ok: true, user: dto(r.user) } : { ok: false, message: r.message };
}

/** Answers identically whether or not the address is known (§7) — never a membership oracle. */
export async function requestCode(input: unknown): Promise<R<{ delivery: 'sent' | 'simulated' | 'unknown' }>> {
  if (!AUTH.otp) return { ok: false, message: 'One-time codes are not enabled for this OS' };
  if (!otpAvailable()) return { ok: false, message: 'One-time codes are not available on this deployment yet — sign in with your password' };   // S6: never a code that only the server log can read
  const p = z.object({ email: Email }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: 'Enter your email' };
  const code = await issueCode(p.data.email);
  const delivery = code ? await deliverCode(p.data.email, code, OS.name) : 'unknown';
  return { ok: true, delivery: delivery === 'unknown' ? 'sent' : delivery };
}
export async function verifyCode(input: unknown): Promise<R<{ user: ReturnType<typeof dto> }>> {
  const p = z.object({ email: Email, code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Enter the 6-digit code' };
  const r = await redeemCode(p.data.email, p.data.code);
  return r.ok ? { ok: true, user: dto(r.user) } : { ok: false, message: r.message };
}

// ── profile ──
export async function updateProfile(input: unknown): Promise<R> {
  const u = await requireUser();
  const p = z.object({ name: z.string().trim().min(1).max(80) }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: 'Enter a name' };
  await query('UPDATE users SET name = $2, updated_at = now() WHERE id = $1', [u.id, p.data.name]);
  revalidatePath('/', 'layout'); return { ok: true };
}
export async function changePassword(input: unknown): Promise<R> {
  const u = await requireUser();
  const p = z.object({ current: z.string().max(128), next: Password }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Invalid password' };
  const rows = await query<{ password_hash: string | null }>('SELECT password_hash FROM users WHERE id = $1', [u.id]);
  if (rows[0]?.password_hash && !(await checkPassword(rows[0].password_hash, p.data.current))) return { ok: false, message: 'Current password is incorrect' };
  await query('UPDATE users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1', [u.id, await hashPassword(p.data.next)]);
  await revokeSessions(u.id);                      // every other session ends (§19.2); this one signs in again
  const r = await signInWithPassword(u.email, p.data.next);
  return r.ok ? { ok: true } : { ok: false, message: 'Password changed — sign in again' };
}

// ── the one write path for pages: a modal, stepper, card, approval, board move or public form ──
const Spec = z.object({ flow: z.string().max(80).optional(), action: z.string().max(80).optional(), direct: z.enum(['insert', 'patch', 'delete']).optional(), entity: z.string().max(80).optional() }).strict();
export async function runAction(input: unknown): Promise<Record<string, unknown>> {
  const p = z.object({ pageId: z.string().max(80), spec: Spec, payload: z.record(z.unknown()) }).strict().safeParse(input);
  if (!p.success) return { ok: false, error: 'Invalid request' };
  const { pageId, spec, payload } = p.data;
  const key = spec.flow ? `flow:${spec.flow}.${spec.action}` : `direct:${spec.direct}:${spec.entity}`;
  const user = await currentUser();
  let actor: Actor;
  if (user) {
    const allowed: string[] = (ACTIONS as unknown as Record<string, string[]>)[user.role] ?? [];
    if (!allowed.includes(key)) return { ok: false, error: 'Not allowed' };
    actor = { kind: 'user', user };
  } else {
    if (!((PUBLIC_ACTIONS as unknown as Record<string, string[]>)[pageId] ?? []).includes(key)) return { ok: false, error: 'Not signed in' };
    actor = { kind: 'public', page: pageId };
  }
  // identity comes from the session, never the payload (§14.6): `user` is what `{{user}}`-scoped pages and audit rows carry
  const body: Record<string, unknown> = { ...payload, user: user?.name ?? '' };
  for (const k of Object.keys(body)) if (k.startsWith('_')) delete body[k];
  try {
    if (spec.direct) {
      const e = (ENTITIES as any)[spec.entity!]; if (!e) return { ok: false, error: 'Unknown entity' };
      const clean: Record<string, unknown> = Object.fromEntries(Object.entries(body).filter(([k]) => e.columns.includes(k)));
      if (spec.direct === 'insert') {
        const row = applyComputed(spec.entity!, clean);                         // v4.9: server recomputes computed: columns (form value ignored)
        const errors = validateEntity(spec.entity!, row);                       // the generated per-entity Zod guards the values (not z.record(z.unknown()))
        if (errors) return { ok: false, error: 'Please check the values', errors };
        const stageErr = validateStage(spec.entity!, '', row);                  // requires_on on a direct create into a stage
        if (stageErr) return { ok: false, error: 'Please check the values', errors: stageErr };
        const rows = await insertRows(actor, spec.entity!, [row]); revalidatePath('/', 'layout');
        return { ok: true, rows, [e.id.column]: rows[0]?.[e.id.column] };
      }
      const id = String(body[e.id.column] ?? ''); if (!id) return { ok: false, error: `${e.id.column} is required` };
      if (spec.direct === 'delete') {                                            // 23 Oct 2026: a confirm modal deletes the one record (scoped, audited by id only)
        const done = await deleteRow(actor, spec.entity!, id); revalidatePath('/', 'layout');
        return done ? { ok: true, deleted: id } : { ok: false, error: 'Not found' };
      }
      let merged: Record<string, unknown> = { ...clean };
      const sc = e.status?.column; let from = ''; let cur: Record<string, unknown> | null = null;
      if (needsCurrentRow(spec.entity!)) {                                       // stage move / recompute / no_past need the stored row
        cur = await getRow(actor, spec.entity!, id); if (!cur) return { ok: false, error: 'Not found' };   // read as the caller: scope applies
        merged = { ...cur, ...clean }; from = sc ? String(cur[sc] ?? '') : '';
      }
      const recomputed = applyComputed(spec.entity!, merged);
      for (const k of Object.keys(recomputed)) if (recomputed[k] !== merged[k]) clean[k] = recomputed[k];   // write only the computed columns that changed
      const errors = validateEntity(spec.entity!, recomputed, cur);   // cur: an unchanged stored no_past date is not re-judged
      if (errors) return { ok: false, error: 'Please check the values', errors };
      const stageErr = validateStage(spec.entity!, from, recomputed);
      if (stageErr) return { ok: false, error: 'Please check the values', errors: stageErr };
      const row = await patchRow(actor, spec.entity!, id, clean); revalidatePath('/', 'layout');
      return row ? { ok: true, rows: [row] } : { ok: false, error: 'Not found' };
    }
    await resolveSend(actor, spec, body);   // D6: the recipient and the message of a sending action come from the record, never from the keyboard
    const capped = await overLimit(actor, pageId);   // v4.7: a daily cap on flow actions (credits), a per-hour cap on a public form — no surprise bill
    if (capped) return { ok: false, error: capped, code: 'LIMIT' };
    const result = await runFlowAction(actor, spec.flow!, spec.action!, body);
    revalidatePath('/', 'layout');
    return result;
  } catch (err) {
    if (err instanceof Conflict) return { ok: false, error: 'This value already exists', code: 'DUPLICATE', errors: { [err.field]: `already in use (${err.existingId})` } };
    if (err instanceof Invalid) return { ok: false, error: 'Please check the values', errors: { [err.field]: 'is not an allowed value' } };
    if (err instanceof NotFound) return { ok: false, error: 'Not found' };
    if (err instanceof InUse) return { ok: false, error: 'This record is still used by other records and cannot be deleted', code: 'IN_USE' };
    console.error('runAction', key, (err as Error).message);
    return { ok: false, error: 'The request could not be completed' };
  }
}

/** v4.7 · cost caps (security round, control 3). Every flow action spends credits in Studio; a looping caller, a scripted visitor on a
 *  public form, or a mis-wired flow can spend a month's plan in an hour. Two fixed-window counters in the `signin_attempts` table (the
 *  kernel's rate-limit store — no new table): `ai:day` for the whole OS per day (`os.limits.actions_per_day`, default 600) and
 *  `pub:<page>` per hour for a public page (`os.limits.public_actions_per_hour`, default 60). Direct writes (no flow, no credits) are
 *  not counted. A cap reached is a plain message a person can read; an admin raises the number in os.yaml, never in the browser. */
async function overLimit(actor: Actor, pageId: string): Promise<string | null> {
  const day = 'ai:day', hour = `pub:${pageId}`;
  if (await rateLimited(day, LIMITS.actions_per_day, 24 * 60)) { console.warn('runAction: daily automation limit reached', LIMITS.actions_per_day); return `Daily automation limit reached (${LIMITS.actions_per_day} actions) — ask an admin`; }
  if (actor.kind === 'public' && (await rateLimited(hour, LIMITS.public_actions_per_hour, 60))) return 'Too many submissions — try again in an hour';
  await recordFailure(day, 24 * 60);
  if (actor.kind === 'public') await recordFailure(hour, 60);
  return null;
}

/** D6 · sends (Haresh review Oct 2026, UI 8). When the flow action declares `sends: { to, message | from, review }`, the server fills the
 *  recipient (and a drafted text) into the payload from the record the modal was opened on: `to: contact` → the entity's contact block
 *  (email for a mail tool, whatsapp/phone otherwise), `to: <key>` → a payload/row key (v4.1 — filled from the row when the browser did
 *  not send it), `to: { entity, match, by, column }` → a lookup into another entity, `to: { role }` → every active user of that role
 *  (emails, comma-separated). `from` names a drafted column copied into Message; a `message` template (per language) is rendered by
 *  lib/renderMessage.js — the one renderer the flow runs too. A reviewed Message (`review: true`) is kept when present. Rule zero: this is
 *  deterministic work, so it is code in the app, not a prompt. */
async function resolveSend(actor: Actor, spec: z.infer<typeof Spec>, body: Record<string, unknown>) {
  if (!spec.flow) return;
  type Send = { tool?: string; to?: unknown; message?: Record<string, string>; from?: string; review?: boolean; template?: { name?: string; variables?: Record<string, string> } };
  const meta = (FLOW_ACTIONS as unknown as Record<string, { send?: Send }>)[`${spec.flow}.${spec.action}`];
  const snd = meta?.send; if (!snd || (!snd.to && !snd.from)) return;
  const ent = spec.entity ? (ENTITIES as any)[spec.entity] : null;
  const idc = ent?.id?.column; const id = idc ? String(body[idc] ?? '') : '';
  const row = ent && id ? await getRow(actor, spec.entity!, id) : null;
  const get = (k: string) => String(row?.[k] ?? '');
  const mail = (snd.tool ?? 'microsoft-outlook') !== 'whatsapp';
  let to = '';
  if (snd.to === 'contact') { const c = ent?.contact ?? {}; to = mail ? get(c.email) : (get(c.whatsapp) || get(c.phone)); }
  else if (typeof snd.to === 'string') { to = String(body[snd.to] ?? '') || get(snd.to); if (to) body[snd.to] = to; }   // a payload/row key (v4.1): keep it under its own name too — the templated flow reads it there
  else if (snd.to && typeof snd.to === 'object' && 'role' in (snd.to as object)) {
    const role = String((snd.to as { role: string }).role);
    const us = await query<{ email: string }>('SELECT email FROM users WHERE role = $1 AND is_active ORDER BY email', [role]);
    to = us.map((u) => u.email).join(', ');
  } else if (snd.to && typeof snd.to === 'object') {
    const lk = snd.to as { entity: string; match: string; by: string; column: string };
    const others = await listRows(actor, lk.entity).catch(() => [] as Record<string, unknown>[]);
    const hit = others.find((r) => String(r[lk.by] ?? '') === get(lk.match));
    to = String(hit?.[lk.column] ?? '');
  }
  if (!mail && to) { const d = to.replace(/\D/g, ''); to = d.length === 10 ? '+91' + d : (d ? '+' + d : ''); }   // v4.4: pucho-whatsapp takes +91… (E.164)
  delete body.To; if (to) body.To = to;
  // the record's own columns a template names travel with the call, so the flow renders the same words the app would (rule zero: from the record, not typed)
  for (const t of [...Object.values(snd.message ?? {}), ...Object.values(snd.template?.variables ?? {})]) for (const m of String(t).matchAll(/\{\{\s*([\w]+)\s*\}\}/g)) { const k = m[1]; if (body[k] === undefined && row && row[k] !== undefined) body[k] = row[k]; }
  const reviewed = snd.review && typeof body.Message === 'string' && (body.Message as string).trim();
  if (!reviewed && snd.from) body.Message = get(snd.from);   // a drafted column; a `message` template is rendered by lib/renderMessage.js (one renderer for app and flow)
}

/** Rows for an entity the page did not preload (a lookup opened later). Same access and scope as the page itself. */
export async function readEntity(input: unknown): Promise<{ ok: true; rows: Record<string, string>[] } | { ok: false; error: string }> {
  const p = z.object({ entity: z.string().max(80) }).strict().safeParse(input);
  if (!p.success) return { ok: false, error: 'Invalid request' };
  const user = await currentUser(); if (!user) return { ok: false, error: 'Not signed in' };
  try { return { ok: true, rows: await listRows({ kind: 'user', user }, p.data.entity) }; } catch { return { ok: false, error: 'Not found' }; }
}

// ── uploads (D6): bytes into the database, type by magic bytes, authorised serving via /api/files ──
const MAGIC: [string, number[]][] = [['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/jpeg', [0xff, 0xd8, 0xff]], ['application/pdf', [0x25, 0x50, 0x44, 0x46]], ['image/webp', [0x52, 0x49, 0x46, 0x46]], ['audio/webm', [0x1a, 0x45, 0xdf, 0xa3]], ['audio/ogg', [0x4f, 0x67, 0x67, 0x53]]];
export async function uploadFile(form: FormData): Promise<R<{ id: string; url: string }>> {
  const user = await currentUser(); if (!user) return { ok: false, message: 'Not signed in' };
  const f = form.get('file'); if (!(f instanceof File)) return { ok: false, message: 'No file' };
  const data = Buffer.from(await f.arrayBuffer());
  const mime = MAGIC.find(([, sig]) => sig.every((b, i) => data[i] === b))?.[0] ?? (f.type.startsWith('audio/') ? f.type : null);
  if (!mime) return { ok: false, message: 'Only PDF, PNG, JPEG, WebP and audio files are accepted' };
  try { const r = await storeFile({ kind: 'user', user }, { name: f.name.slice(0, 120), mime, data }); return { ok: true, ...r }; }
  catch (e) { return { ok: false, message: (e as Error).message }; }
}

// ── users & roles (standards §6): compulsory, behind the admin role, every rule enforced here, not in the UI ──
type UserRow = { id: string; email: string; name: string; role: string; is_active: boolean; must_change_password: boolean; created_at: string };
async function requireAdmin(): Promise<SessionUser> { const u = await requireUser(); if (u.role !== 'admin') throw new Error('Not allowed'); return u; }
async function lastAdmin(exceptId: string): Promise<boolean> {
  const r = await query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND is_active AND id <> $1", [exceptId]); return r[0].n === 0;
}
export async function listUsers(): Promise<R<{ users: UserRow[] }>> {
  await requireAdmin();
  const users = await query<UserRow>('SELECT id, email, name, role, is_active, must_change_password, created_at::text FROM users ORDER BY created_at');
  return { ok: true, users };
}
export async function createUser(input: unknown): Promise<R<{ id: string }>> {
  const admin = await requireAdmin();
  const p = z.object({ name: z.string().trim().min(1).max(80), email: Email, role: z.enum(ROLE_KEYS), password: Password.optional() }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Check the fields' };
  const id = newId('USR');
  try {
    await query('INSERT INTO users (id, email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, p.data.email, p.data.name, p.data.role, p.data.password ? await hashPassword(p.data.password) : null, true]);
  } catch (e) { return { ok: false, message: /unique/i.test((e as Error).message) ? 'That email already has an account' : 'Could not create the user' }; }
  await writeAudit({ kind: 'user', user: admin }, 'direct', 'create user', 'users', id, { email: p.data.email, role: p.data.role });
  revalidatePath('/', 'layout'); return { ok: true, id };
}
export async function setUserActive(input: unknown): Promise<R> {
  const admin = await requireAdmin();
  const p = z.object({ id: z.string().max(40), active: z.boolean() }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: 'Invalid request' };
  if (p.data.id === admin.id) return { ok: false, message: 'You cannot deactivate yourself' };
  const rows = await query<{ role: string }>('SELECT role FROM users WHERE id = $1', [p.data.id]); if (!rows[0]) return { ok: false, message: 'Not found' };
  if (!p.data.active && rows[0].role === 'admin' && await lastAdmin(p.data.id)) return { ok: false, message: 'This is the last active administrator' };
  await query('UPDATE users SET is_active = $2, deactivated_at = CASE WHEN $2 THEN NULL ELSE now() END, deactivated_by = CASE WHEN $2 THEN NULL ELSE $3 END, updated_at = now() WHERE id = $1', [p.data.id, p.data.active, admin.email]);
  if (!p.data.active) await revokeSessions(p.data.id);      // the account stops working now, not when the cookie expires
  await writeAudit({ kind: 'user', user: admin }, 'direct', p.data.active ? 'reactivate user' : 'deactivate user', 'users', p.data.id, {});
  revalidatePath('/', 'layout'); return { ok: true };
}
export async function setUserRole(input: unknown): Promise<R> {
  const admin = await requireAdmin();
  const p = z.object({ id: z.string().max(40), role: z.enum(ROLE_KEYS) }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: 'Invalid request' };
  if (p.data.id === admin.id) return { ok: false, message: 'You cannot change your own role' };   // §6.3
  const rows = await query<{ role: string }>('SELECT role FROM users WHERE id = $1 AND is_active', [p.data.id]); if (!rows[0]) return { ok: false, message: 'Not found' };
  if (rows[0].role === 'admin' && p.data.role !== 'admin' && await lastAdmin(p.data.id)) return { ok: false, message: 'This is the last active administrator' };
  await query('UPDATE users SET role = $2, updated_at = now() WHERE id = $1', [p.data.id, p.data.role]);
  await revokeSessions(p.data.id);                           // a new authority needs a new session (§19.2)
  await writeAudit({ kind: 'user', user: admin }, 'direct', 'set role', 'users', p.data.id, { role: p.data.role });
  revalidatePath('/', 'layout'); return { ok: true };
}
export async function resetUserPassword(input: unknown): Promise<R> {
  await requireAdmin();
  const p = z.object({ id: z.string().max(40), password: Password }).strict().safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? 'Invalid request' };
  const r = await query('UPDATE users SET password_hash = $2, must_change_password = true, updated_at = now() WHERE id = $1 RETURNING id', [p.data.id, await hashPassword(p.data.password)]);
  if (!r[0]) return { ok: false, message: 'Not found' };
  await revokeSessions(p.data.id); return { ok: true };
}
