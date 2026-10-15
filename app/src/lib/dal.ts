// src/lib/dal.ts — the data-access layer (standards §19.3): who is asking, what they may see, scoped queries, DTOs.
// Every read and every write of an entity — from a Server Component, a Server Action or a Route Handler a flow calls —
// goes through here, so one place knows the entity vocabulary (ENTITIES from os.yaml), the role → entity access map
// and the per-person scope (ACCESS, generated), the audit log and the encrypted columns.
import 'server-only';
import { randomBytes } from 'node:crypto';
import { pool, query } from './db';
import { ENTITIES } from '@/config/os.config';
import { ENTITY_ACCESS, SCOPES, PUBLIC_ENTITIES } from '@/config/access';
import { encryptField, decryptField, isCiphertext, blindIndex, encryptionConfigured } from './crypto';
import type { SessionUser } from './auth';

export type Actor = { kind: 'user'; user: SessionUser } | { kind: 'flow'; name: string } | { kind: 'public'; page: string } | { kind: 'system' };
export type Row = Record<string, string>;
type Entity = { id: { column: string; prefix: string }; columns: string[]; types?: Record<string, string>; created?: string | null; encrypted?: string[]; status?: { column: string; values: string[] } | null; unique?: string[]; unique_together?: string[][] };
const E = ENTITIES as unknown as Record<string, Entity>;

/** v4.9 duplicate detection. Pre-check the entity's declared uniqueness — field-level `unique:` (each its own group)
 *  and entity-level `unique_together:` (a composite group) — against a row about to be written. Returns the first
 *  conflict (the group's columns joined, and the existing row's id) or null. `exceptId` excludes the row being patched.
 *  A group whose columns are not all present and non-empty in `row` is skipped (a patch that doesn't touch them can't
 *  collide); encrypted columns are not matched here (the UNIQUE index on them is the guard). The database UNIQUE index
 *  generated alongside is the last line, so a race that slips past this pre-check still fails the insert. */
/** Map a Postgres unique-violation constraint name back to a field label for the 409 body. Our indexes are named
 *  `<table>_<col…>_uq` (gen_schema). Falls back to the raw constraint name. */
function uniqueFieldFromConstraint(entity: string, constraint?: string): string {
  if (!constraint) return 'value';
  let s = constraint; const pre = `${entity.toLowerCase()}_`;
  if (s.toLowerCase().startsWith(pre)) s = s.slice(pre.length);
  if (s.toLowerCase().endsWith('_uq')) s = s.slice(0, -3);
  const cols = entityOf(entity).columns;
  const match = cols.find((c) => c.toLowerCase() === s.toLowerCase());
  return match ?? s ?? 'value';
}
const isUniqueViolation = (err: unknown): err is { code: string; constraint?: string } => (err as { code?: string })?.code === '23505';
const isCheckViolation = (err: unknown): err is { code: string; constraint?: string } => (err as { code?: string })?.code === '23514';
/** A v4.9 CHECK is named `<table>_<col>_v49_<hash>` (scaffold_os.py check_sync_sql), an older inline one `<table>_<col>_check`. */
function checkFieldFromConstraint(entity: string, constraint?: string): string {
  const m = /^(.*)_v49_[0-9a-f]{8}$/.exec(constraint ?? '') ?? /^(.*)_check$/.exec(constraint ?? '');
  return m ? uniqueFieldFromConstraint(entity, `${m[1]}_uq`) : 'value';
}
/** The database refused a value its CHECK guards (the app-layer Zod is the first line; this is the last). → 400. */
export class Invalid extends Error { constructor(public field: string) { super('Invalid value'); } }

export async function findDuplicate(entity: string, row: Record<string, unknown>, exceptId?: string): Promise<{ field: string; id: string } | null> {
  const e = entityOf(entity);
  const groups: string[][] = [...(e.unique ?? []).map((c) => [c]), ...(e.unique_together ?? [])];
  for (const g of groups) {
    if (g.some((c) => e.encrypted?.includes(c))) continue;
    if (!g.every((c) => c in row && String(row[c] ?? '').trim() !== '')) continue;
    const where = g.map((c, i) => `${col(c)} = $${i + 1}`).join(' AND ');
    const vals = g.map((c) => row[c]);
    const sql = `SELECT ${col(e.id.column)} AS id FROM ${table(entity)} WHERE ${where}${exceptId ? ` AND ${col(e.id.column)} <> $${g.length + 1}` : ''} LIMIT 1`;
    const r = await query<{ id: string }>(sql, exceptId ? [...vals, exceptId] : vals);
    if (r[0]) return { field: g.join('+'), id: String(r[0].id) };
  }
  return null;
}
const AUDIT = 'audit_log' in E;

export class NotFound extends Error { constructor(m = 'Not found') { super(m); } }
export class Forbidden extends Error { constructor(m = 'Not allowed') { super(m); } }
/** A write would duplicate a value the entity declared `unique` (or `unique_together`). Carries the offending field(s)
 *  and the id of the existing row, so a caller can answer 409 with a field-keyed error (v4.9 duplicate detection). */
export class Conflict extends Error { constructor(public field: string, public existingId: string) { super('Duplicate'); } }

export const table = (entity: string) => `"${entity}"`;
export const col = (c: string) => `"${c.toLowerCase()}"`;
export function entityOf(name: string): Entity { const e = E[name]; if (!e) throw new NotFound(`no entity ${name}`); return e; }

/** May this actor read the entity at all? (A record they may not see is a 404, never a 403 — §14.4.) */
export function canRead(actor: Actor, entity: string): boolean {
  if (!(entity in E)) return false;
  if (actor.kind === 'system' || actor.kind === 'flow') return true;
  if (actor.kind === 'public') return ((PUBLIC_ENTITIES as unknown as Record<string, string[]>)[actor.page] ?? []).includes(entity);
  const allowed = (ENTITY_ACCESS as unknown as Record<string, string[]>)[actor.user.role] ?? [];
  return allowed.includes('*') || allowed.includes(entity);
}
/** The column a self-service role is pinned to on this entity (`Rep={{user}}` on every page it can open) — scope applies server-side. */
export function scopeOf(actor: Actor, entity: string): { column: string; value: string } | null {
  if (actor.kind !== 'user') return null;
  const s = ((SCOPES as unknown as Record<string, Record<string, string>>)[actor.user.role] ?? {})[entity];
  return s ? { column: s, value: actor.user.name } : null;
}

// ── value shaping: the kernel reads every value as a string (as it did from CSV / PostgREST); the database keeps real types ──
function fromDb(e: Entity, r: Record<string, unknown>, entity: string): Row {
  const out: Row = {};
  for (const c of e.columns) {
    const v = r[c.toLowerCase()];
    let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (e.encrypted?.includes(c) && isCiphertext(s)) { try { s = decryptField(s, `${entity}.${c}:${r[e.id.column.toLowerCase()]}`); } catch { s = '••••'; } }
    out[c] = s;
  }
  return out;
}
function toDb(e: Entity, entity: string, row: Record<string, unknown>, id: string): { cols: string[]; vals: unknown[] } {
  const cols: string[] = []; const vals: unknown[] = [];
  for (const c of e.columns) {
    if (!(c in row)) continue;
    const raw = row[c]; const t = e.types?.[c] ?? 'text';
    let v: unknown = raw == null ? null : Array.isArray(raw) || (typeof raw === 'object') ? JSON.stringify(raw) : raw;
    if (v === '' && t !== 'text') v = null;
    if (v != null && t === 'numeric') { const n = Number(v); v = Number.isFinite(n) ? n : null; }
    if (v != null && t === 'boolean') v = ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
    if (v != null && (t === 'date' || t === 'timestamptz') && String(v).trim() === '') v = null;
    if (v != null && e.encrypted?.includes(c)) {
      if (!encryptionConfigured()) throw new Error(`${entity}.${c} is declared encrypted but FIELD_ENC_KEYS is not set`);
      const plain = String(v); v = encryptField(plain, `${entity}.${c}:${id}`); cols.push(`${c.toLowerCase()}_bidx`); vals.push(blindIndex(plain));
    }
    cols.push(c.toLowerCase()); vals.push(v);
  }
  return { cols, vals };
}

/** v4.9 (§19) · set the row-level-security context for this transaction, so Postgres enforces the same scope the DAL does
 *  (db/rls.sql). `pucho.scope` = the person's scope value, `pucho.unscoped` = '1' for an actor with no scope on this entity
 *  (admin, flow, system). set_config(…, true) is transaction-local, so every caller runs inside a BEGIN/COMMIT. In dev the
 *  app connects as the superuser, which bypasses RLS, so this is a no-op locally; on a handed-over Pucho DB (the `app` role)
 *  it is what makes a cross-scope row invisible even to a query that forgot its WHERE. */
async function setScope(client: { query: typeof pool.query }, actor: Actor, entity: string): Promise<void> {
  const scope = scopeOf(actor, entity);
  if (scope) await client.query("SELECT set_config('pucho.scope', $1, true), set_config('pucho.unscoped', '0', true)", [scope.value]);
  else await client.query("SELECT set_config('pucho.scope', '', true), set_config('pucho.unscoped', '1', true)");
}
/** Run `fn` inside a transaction whose RLS scope context is set for `actor`/`entity`. */
async function inScope<T>(actor: Actor, entity: string, fn: (c: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await setScope(client, actor, entity); const r = await fn(client); await client.query('COMMIT'); return r; }
  catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

// ── reads (each inside a transaction that sets the RLS scope context; the app-layer WHERE stays as the first guard) ──
export async function listRows(actor: Actor, entity: string): Promise<Row[]> {
  if (!canRead(actor, entity)) throw new NotFound();
  const e = entityOf(entity); const scope = scopeOf(actor, entity);
  const rows = await inScope(actor, entity, (c) => c.query(
    `SELECT row_to_json(t) AS r FROM ${table(entity)} t ${scope ? `WHERE ${col(scope.column)} = $1` : ''} ORDER BY t._seq DESC`, scope ? [scope.value] : []));
  return rows.rows.map((x: { r: Record<string, unknown> }) => fromDb(e, x.r, entity));
}
export async function getRow(actor: Actor, entity: string, id: string): Promise<Row | null> {
  if (!canRead(actor, entity)) return null;
  const e = entityOf(entity); const scope = scopeOf(actor, entity);
  const rows = await inScope(actor, entity, (c) => c.query(
    `SELECT row_to_json(t) AS r FROM ${table(entity)} t WHERE ${col(e.id.column)} = $1 ${scope ? `AND ${col(scope.column)} = $2` : ''}`, scope ? [id, scope.value] : [id]));
  return rows.rows[0] ? fromDb(e, rows.rows[0].r, entity) : null;
}
/** Everything the actor may read, for the entities named — one round trip per entity, missing ones skipped. */
export async function loadEntities(actor: Actor, names: string[]): Promise<Record<string, Row[]>> {
  const out: Record<string, Row[]> = {};
  await Promise.all([...new Set(names)].filter((n) => n in E && canRead(actor, n)).map(async (n) => { out[n] = await listRows(actor, n); }));
  return out;
}

// ── ids: <prefix><year>-<nnnn>, numbered inside the year, under an advisory lock so two inserts never share one. The next
// number is the highest existing one + 1 — NOT count + 1: seeded / imported ids are sparse (ENQ-2026-0139 among 0288–0300),
// so a count lands on a taken id and ON CONFLICT DO NOTHING silently dropped the row (201 with []) — v4.9 fix ──
export async function nextId(entity: string, client: { query: typeof pool.query } = pool): Promise<string> {
  const e = entityOf(entity); const year = String(new Date().getFullYear()); const sep = e.id.prefix.endsWith('-') ? '-' : '/';
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [entity]);
  const r = await client.query(`SELECT coalesce(max(substring(${col(e.id.column)} from '([0-9]{1,15})$')::bigint), 0)::text AS n FROM ${table(entity)} WHERE ${col(e.id.column)} LIKE $1`, [`${e.id.prefix}${year}${sep}%`]);
  return `${e.id.prefix}${year}${sep}${String(Number(r.rows[0].n) + 1).padStart(4, '0')}`;
}

// ── writes ──
export async function insertRows(actor: Actor, entity: string, rows: Record<string, unknown>[], opts: { flow?: string; action?: string; audit?: boolean } = {}): Promise<Row[]> {
  const e = entityOf(entity); const out: Row[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setScope(client, actor, entity);                 // v4.9: RLS WITH CHECK governs the new row for the `app` role
    for (const raw of rows) {
      const row: Record<string, unknown> = {};
      for (const c of e.columns) if (c in raw) row[c] = raw[c];
      let id = String(row[e.id.column] ?? '').trim();
      if (!id) id = await nextId(entity, client);
      row[e.id.column] = id;
      const dup = await findDuplicate(entity, row);       // v4.9: refuse a declared-unique collision before the insert (→ 409)
      if (dup) throw new Conflict(dup.field, dup.id);
      if (e.created && !row[e.created]) row[e.created] = new Date().toISOString();
      const { cols, vals } = toDb(e, entity, row, id);
      const r = await client.query(
        `INSERT INTO ${table(entity)} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})
         ON CONFLICT (${col(e.id.column)}) DO NOTHING RETURNING row_to_json(${table(entity)}) AS r`, vals);   // idempotent on the natural key (§15.4)
      if (r.rows[0]) out.push(fromDb(e, r.rows[0].r, entity));
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (isUniqueViolation(err)) throw new Conflict(uniqueFieldFromConstraint(entity, err.constraint), '');   // the UNIQUE index is the last line even when the pre-check could not see the row (RLS)
    if (isCheckViolation(err)) throw new Invalid(checkFieldFromConstraint(entity, err.constraint));
    throw err;
  } finally { client.release(); }
  if (opts.audit !== false) for (const r of out) await writeAudit(actor, opts.flow ?? 'direct', opts.action ?? 'insert', entity, r[e.id.column], r);
  return out;
}

export async function patchRow(actor: Actor, entity: string, id: string, patch: Record<string, unknown>, opts: { flow?: string; action?: string; audit?: boolean } = {}): Promise<Row | null> {
  const e = entityOf(entity);
  const dup = await findDuplicate(entity, patch, id);     // v4.9: a patch may not move a unique value onto another row's (→ 409)
  if (dup) throw new Conflict(dup.field, dup.id);
  const { cols, vals } = toDb(e, entity, Object.fromEntries(Object.entries(patch).filter(([k]) => k !== e.id.column)), id);
  if (!cols.length) return getRow(actor, entity, id);
  const scope = scopeOf(actor, entity);
  let r;
  try {
    r = await inScope(actor, entity, (c) => c.query(
      `UPDATE ${table(entity)} SET ${cols.map((cc, i) => `"${cc}" = $${i + 1}`).join(', ')} WHERE ${col(e.id.column)} = $${cols.length + 1} ${scope ? `AND ${col(scope.column)} = $${cols.length + 2}` : ''}
       RETURNING row_to_json(${table(entity)}) AS r`, scope ? [...vals, id, scope.value] : [...vals, id]));
  } catch (err) {
    if (isUniqueViolation(err)) throw new Conflict(uniqueFieldFromConstraint(entity, err.constraint), '');
    if (isCheckViolation(err)) throw new Invalid(checkFieldFromConstraint(entity, err.constraint));
    throw err;
  }
  if (!r.rows[0]) return null;                                                 // a row outside the person's scope does not exist to them
  const row = fromDb(e, r.rows[0].r, entity);
  if (opts.audit !== false) await writeAudit(actor, opts.flow ?? 'direct', opts.action ?? 'patch', entity, id, patch);
  return row;
}

/** A scheduled sync owns its whole table: clear and refill in one transaction (the Sheets `clear_sheet` + insert of v3). */
export async function replaceRows(actor: Actor, entity: string, rows: Record<string, unknown>[], opts: { flow?: string } = {}): Promise<number> {
  const e = entityOf(entity); const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setScope(client, actor, entity);                 // v4.9: a scoped sync only clears/refills rows in its own scope
    await client.query(`DELETE FROM ${table(entity)}`);
    let n = 0;
    for (const raw of rows) {
      const row: Record<string, unknown> = {}; for (const c of e.columns) if (c in raw) row[c] = raw[c];
      let id = String(row[e.id.column] ?? '').trim(); if (!id) id = await nextId(entity, client); row[e.id.column] = id;
      const { cols, vals } = toDb(e, entity, row, id);
      await client.query(`INSERT INTO ${table(entity)} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT (${col(e.id.column)}) DO NOTHING`, vals); n++;
    }
    await client.query('COMMIT');
    await writeAudit(actor, opts.flow ?? 'sync', 'replace', entity, '', { rows: n });
    return n;
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

// ── audit (os.audit: true): one writer — this layer — for every write, whoever asked for it ──
export const actorName = (a: Actor) => a.kind === 'user' ? a.user.name : a.kind === 'flow' ? `flow:${a.name}` : a.kind === 'public' ? 'public form' : 'system';
export async function writeAudit(actor: Actor, flow: string, action: string, entity: string, recordId: string, payload: Record<string, unknown>) {
  if (!AUDIT || entity === 'audit_log') return;
  const summary = Object.entries(payload).filter(([k, v]) => !k.startsWith('_') && k !== 'action' && typeof v !== 'object' && String(v ?? '').trim()).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v).slice(0, 40)}`).join(' · ');
  const a = E.audit_log; const row = { Audit_ID: `AUD-${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`, At: new Date().toISOString(), Who: actorName(actor), Flow: flow, Action: action, Entity: entity, Record_ID: String(recordId ?? ''), Summary: summary };
  const { cols, vals } = toDb(a, 'audit_log', row, row.Audit_ID);
  await query(`INSERT INTO "audit_log" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`, vals);
}

// ── files (D6): bytes live in the database, under the plan's cap ──
export async function storeFile(actor: Actor, f: { name: string; mime: string; data: Buffer; entity?: string; recordId?: string }): Promise<{ id: string; url: string }> {
  const maxMb = Number(process.env.FILES_MAX_MB || 10); const capMb = Number(process.env.FILES_CAP_MB || 400);
  if (f.data.length > maxMb * 1024 * 1024) throw new Error(`File is over ${maxMb} MB`);
  const used = await query<{ used: string }>('SELECT coalesce(sum(size), 0)::text AS used FROM files');
  if (Number(used[0].used) + f.data.length > capMb * 1024 * 1024) throw new Error('The storage cap for this OS is reached — delete old files or raise the plan');
  const id = `F-${randomBytes(8).toString('hex')}`;
  await query('INSERT INTO files (id, name, mime, size, data, entity, record_id, uploaded_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [id, f.name, f.mime, f.data.length, f.data, f.entity ?? null, f.recordId ?? null, actorName(actor)]);
  return { id, url: `/api/files/${id}` };
}
export async function readFile(id: string): Promise<{ name: string; mime: string; data: Buffer } | null> {
  const r = await query<{ name: string; mime: string; data: Buffer }>('SELECT name, mime, data FROM files WHERE id = $1', [id]);
  return r[0] ?? null;
}
