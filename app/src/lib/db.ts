// src/lib/db.ts — the ONE connection resolver and the ONE pool (standards/fullstack-build-standard.md §13).
// Server Components, Server Actions, Route Handlers and the db scripts all import this; two resolvers is how a seed
// lands in one database while the server reads another.
import 'server-only';
import { Pool, type PoolConfig } from 'pg';

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|::1|host\.docker\.internal|db|postgres)$/i;
const env = (k: string) => { const v = process.env[k]; return v == null || v.trim() === '' ? undefined : v.trim(); };

export type DbConfig = { host: string; port: number; database: string; user: string; password: string; schema: string; ssl: boolean; source: 'DB_* variables' | 'DATABASE_URL' };

function wantsSsl(host: string): boolean {
  const explicit = env('DB_SSL');
  if (explicit != null) return ['1', 'true', 'require', 'yes', 'on'].includes(explicit.toLowerCase());
  return !LOCAL_HOST.test(host);
}

export function resolveDbConfig(): DbConfig {
  const schema = env('DB_SCHEMA') ?? 'public';
  if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(schema)) throw new Error(`DB_SCHEMA "${schema}" is not a valid identifier`);
  const host = env('DB_HOST');
  if (host) {                                   // the discrete form wins OUTRIGHT (§13.1)
    const database = env('DB_NAME'); const user = env('DB_USER');
    if (!database) throw new Error('DB_HOST is set, so DB_NAME is required too.');
    if (!user) throw new Error('DB_HOST is set, so DB_USER is required too.');
    const port = Number(env('DB_PORT') ?? 5432);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`DB_PORT "${env('DB_PORT')}" is not a port`);
    return { host, port, database, user, password: env('DB_PASSWORD') ?? '', schema, ssl: wantsSsl(host), source: 'DB_* variables' };
  }
  const raw = env('DATABASE_URL');
  if (!raw) throw new Error('Set DATABASE_URL (development) or DB_HOST + DB_NAME + DB_USER (deployment).');
  const url = new URL(raw);
  return { host: url.hostname, port: Number(url.port || 5432), database: decodeURIComponent(url.pathname.slice(1)), user: decodeURIComponent(url.username || 'postgres'),
           password: decodeURIComponent(url.password), schema, ssl: wantsSsl(url.hostname), source: 'DATABASE_URL' };
}

export function poolOptions(cfg: DbConfig): PoolConfig {
  const ca = env('DB_SSL_CA');
  return {
    host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user, password: cfg.password, max: 8,
    // every connection, replacements included: the search_path, and the client's time zone so timestamps read as IST in
    // Studio reports and API answers (the browser formats in its own zone anyway)
    options: [cfg.schema === 'public' ? '' : `-c search_path=${cfg.schema},public`, `-c TimeZone=${(env('DB_TIMEZONE') ?? 'Asia/Kolkata').replace(/[^A-Za-z0-9_\/+-]/g, '')}`].filter(Boolean).join(' '),
    ...(cfg.ssl ? { ssl: ca ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: false } } : {}),
  };
}

// §13.3 — a bad configuration logs and starts; it never kills the process before it listens (the operator would only see 502).
export let dbConfigError: string | null = null;
function safeResolve(): DbConfig {
  try { return resolveDbConfig(); }
  catch (err) {
    dbConfigError = err instanceof Error ? err.message : String(err);
    console.error(`DATABASE CONFIGURATION INVALID — data requests will fail: ${dbConfigError}`);
    return { host: '0.0.0.0', port: 1, database: 'unconfigured', user: 'unconfigured', password: '', schema: 'public', ssl: false, source: 'DB_* variables' };
  }
}
export const dbConfig = safeResolve();
export const describeDb = (c: DbConfig) => `${c.user}@${c.host}:${c.port}/${c.database} (schema ${c.schema}${c.ssl ? (env('DB_SSL_CA') ? ', ssl verified' : ', ssl NOT VERIFIED — set DB_SSL_CA') : ''}) via ${c.source}`;

// §13.2 — one pool, cached on globalThis so `next dev`'s hot reload does not open a new set of connections per save.
declare global { var __pgPool: Pool | undefined }   // eslint-disable-line no-var
export const pool: Pool = process.env.NODE_ENV === 'production' ? new Pool(poolOptions(dbConfig)) : (globalThis.__pgPool ??= new Pool(poolOptions(dbConfig)));
pool.on('error', (e) => console.error('pg pool error:', e.message));

export async function query<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(text, params);
  return r.rows as T[];
}
