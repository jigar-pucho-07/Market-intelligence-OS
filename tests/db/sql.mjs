// tests/db/sql.mjs — run SQL against the dev database named by app/.env DATABASE_URL (never prints the password).
// Usage: node tests/db/sql.mjs "SELECT 1"
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url)); const APP = path.resolve(HERE, '..', '..', 'app');
const require = createRequire(path.join(APP, 'package.json')); const pg = require('pg');
export function dbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(APP, '.env'), 'utf8'); const m = env.match(/^\s*DATABASE_URL\s*=\s*(.+)$/m);
  return m ? m[1].trim().replace(/^"|"$/g, '') : '';
}
export async function sql(text, params = []) { const c = new pg.Client({ connectionString: dbUrl() }); await c.connect(); try { return (await c.query(text, params)).rows; } finally { await c.end(); } }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rows = await sql(process.argv[2]); console.table(rows);
}
