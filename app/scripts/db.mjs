#!/usr/bin/env node
// scripts/db.mjs — apply the schema, seed demo data, reset, or create a person. ONE resolver: the same rules as
// src/lib/db.ts (DB_HOST wins outright, else DATABASE_URL), so a seed never lands in a database the server does not read.
//   node scripts/db.mjs migrate            apply db/schema.sql (idempotent) and create the app / studio_reader roles when allowed
//   node scripts/db.mjs seed [--no-personas] load db/seed/*.csv (demo rows) and the persona accounts from db/seed/users.json
//   node scripts/db.mjs reset              drop every entity table's rows and re-seed
//   node scripts/db.mjs user <email> <name> <role> [password]   the first administrator (standards §6.4)
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { hash } from '@node-rs/argon2';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
for (const f of ['.env.local', '.env']) {        // the same files Next.js reads, in the same order of precedence
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim(); }
}
const env = (k) => { const v = process.env[k]; return v == null || v.trim() === '' ? undefined : v.trim(); };
const LOCAL = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal|db|postgres)$/i;
function config() {
  const host = env('DB_HOST'); const schema = env('DB_SCHEMA') ?? 'public';
  if (host) return { host, port: Number(env('DB_PORT') ?? 5432), database: env('DB_NAME'), user: env('DB_USER'), password: env('DB_PASSWORD') ?? '', schema, ssl: !LOCAL.test(host) };
  const url = new URL(env('DATABASE_URL') ?? ''); return { host: url.hostname, port: Number(url.port || 5432), database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username || 'postgres'), password: decodeURIComponent(url.password), schema, ssl: !LOCAL.test(url.hostname) };
}
const cfg = config();
const pool = new pg.Pool({ host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password, ...(cfg.schema === 'public' ? {} : { options: `-c search_path=${cfg.schema},public` }), ...(cfg.ssl ? { ssl: env('DB_SSL_CA') ? { ca: env('DB_SSL_CA').replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: false } } : {}) });
const say = (s) => console.log(s);
say(`Database: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} (schema ${cfg.schema}${cfg.ssl ? ', ssl' : ''})`);

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { if (q && text[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { row.push(cur); cur = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const [h, ...rest] = rows.filter((r) => r.some((x) => x !== ''));
  return rest.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}

async function migrate() {
  const sql = fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8');
  const c = await pool.connect();
  try { await c.query('BEGIN'); await c.query(sql); await c.query('COMMIT'); say('schema applied (idempotent)'); }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  // least privilege (§19.1 / D4): an `app` role with DML only and a `studio_reader` with SELECT on entity tables only.
  // Pucho DB may hand over a single user that cannot create roles — then this is recorded, not pretended.
  const rolesSql = path.join(ROOT, 'db', 'roles.sql');
  if (fs.existsSync(rolesSql)) {
    try { await pool.query(fs.readFileSync(rolesSql, 'utf8')); say('roles app / studio_reader ensured'); }
    catch (e) { say(`roles NOT created (${e.message.split('\n')[0]}) — the connected user cannot create roles; record it in docs/security.md Known-broken (§19.1)`); }
  }
  // v4.9 (§19): row-level security for the `app` role — defense in depth over the DAL's scope. Needs the roles above; the
  // schema owner (dev superuser) bypasses RLS, so this changes nothing locally but bites when the app logs in as `app`.
  const rlsSql = path.join(ROOT, 'db', 'rls.sql');
  if (fs.existsSync(rlsSql)) {
    try { await pool.query(fs.readFileSync(rlsSql, 'utf8')); say('row-level security policies applied'); }
    catch (e) { say(`RLS NOT applied (${e.message.split('\n')[0]}) — the connected user cannot alter RLS; record it in docs/security.md Known-broken (§19.1)`); }
  }
}

async function seed(personas = true) {
  const dir = path.join(ROOT, 'db', 'seed'); const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const e of manifest.entities) {
      const file = path.join(dir, `${e.name}.csv`); if (!fs.existsSync(file)) continue;
      const rows = parseCSV(fs.readFileSync(file, 'utf8')); let n = 0;
      // the file's order is the display order (the DAL reads _seq DESC): row i gets _seq = rows - i, and the sequence continues above it
      for (const [i, r] of rows.entries()) {
        const cols = ['_seq'], vals = [rows.length - i];
        for (const col of e.columns) {
          const t = e.types[col] ?? 'text'; let v = r[col] ?? '';
          if (v === '' && t !== 'text') v = null; else if (t === 'boolean') v = ['true', '1', 'yes'].includes(String(v).toLowerCase()); else if (t === 'numeric') { const x = Number(v); v = Number.isFinite(x) ? x : null; }
          cols.push(`"${col.toLowerCase()}"`); vals.push(v);
        }
        const q = await c.query(`INSERT INTO "${e.name}" (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT DO NOTHING`, vals); n += q.rowCount;
      }
      await c.query(`SELECT setval(pg_get_serial_sequence('"${e.name}"', '_seq'), GREATEST((SELECT coalesce(max(_seq), 0) FROM "${e.name}"), 1))`);
      say(`  ${e.name}: ${n} rows`);
    }
    if (personas) {
      const users = JSON.parse(fs.readFileSync(path.join(dir, 'users.json'), 'utf8'));
      for (const u of users) {
        await c.query(`INSERT INTO users (id, email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, $5, false)
                       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, is_active = true`,
          [u.id, u.email.toLowerCase(), u.name, u.role, await hash(u.password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })]);
      }
      say(`  users: ${users.length} demo personas (demo build only — never seed personas on a client's production database)`);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

async function reset() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'db', 'seed', 'manifest.json'), 'utf8'));
  for (const e of manifest.entities) await pool.query(`DELETE FROM "${e.name}"`);
  await pool.query('DELETE FROM sessions'); await pool.query('DELETE FROM users');
  say('rows cleared'); await seed(true);
}

async function user([email, name, role, password]) {
  if (!email || !name || !role) { say('usage: node scripts/db.mjs user <email> <name> <role> [password]'); process.exit(2); }
  const pw = password || Buffer.from(Array.from({ length: 12 }, () => Math.floor(Math.random() * 256))).toString('base64url').slice(0, 14);
  const id = `USR-${Date.now().toString(36).toUpperCase()}`;
  await pool.query('INSERT INTO users (id, email, name, role, password_hash, must_change_password) VALUES ($1, $2, $3, $4, $5, true) ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, must_change_password = true, is_active = true',
    [id, email.toLowerCase(), name, role, await hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 })]);
  say(`user ${email} (${role}) ready — temporary password: ${pw}  (they must change it at first sign-in)`);
}

/** The demo seed (rows + persona accounts with known passwords) belongs on a demo database only. It refuses a database that
 *  does not look like one — a DB_HOST target (the portal's injected block) or a name that does not end in _dev / _demo /
 *  _gate — unless `--demo-db` says the person knows what they are doing (audit S4 / S10, Oct 2026). */
function demoGuard(args) {
  const name = String(cfg.database || ''); const looksDemo = /_(dev|demo|gate\w*|test)$/i.test(name) || /^gate_/i.test(name);
  if (args.includes('--demo-db')) return;
  if (env('DB_HOST') || !LOCAL.test(cfg.host) || !looksDemo) {
    console.error(`db seed refused: ${cfg.user}@${cfg.host}/${name} does not look like a demo database (name not *_dev / *_demo, or a DB_HOST / remote target).` +
      `\n  Personas with known passwords must never land on a client's database. For a real demo deployment run: node scripts/db.mjs seed --demo-db`);
    process.exit(3);
  }
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === 'migrate') await migrate();
  else if (cmd === 'seed') { demoGuard(rest); await seed(!rest.includes('--no-personas')); }
  else if (cmd === 'reset') await reset();
  else if (cmd === 'user') await user(rest);
  else { say('usage: node scripts/db.mjs migrate | seed [--no-personas] [--demo-db] | reset | user <email> <name> <role> [password]'); process.exit(2); }
} catch (e) { console.error(`db ${cmd} failed: ${e.message}`); process.exit(1); } finally { await pool.end(); }
