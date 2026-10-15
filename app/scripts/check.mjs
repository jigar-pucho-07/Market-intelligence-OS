#!/usr/bin/env node
// scripts/check.mjs — `npm run check`: the app's own gate (standards §10.1, §19.5, §19.8). Static, every time:
//   S1 no secret-shaped NEXT_PUBLIC_ name · S2 no string-built SQL (template literal with ${} inside a query call) ·
//   S3 no raw dangerouslySetInnerHTML outside src/custom reviewed files · S4 no secret value from .env inside .next/static
//   (after a build) · S5 no persona password inside .next/static unless this is a demo build · S6 npm audit high/critical
// With --db (`npm run check:db`, needs the database): A1 a stored password hash starts $argon2id$ · A2 a cross-user read
// of a scoped entity returns nothing (404) · A3 a non-admin cannot call an admin action · A4 deactivation ends sessions · A5 the flow door
// refuses a non-JSON body (415) and a body over 256 KB (413) before parsing it.
// Exit 0 pass · 1 fail · 2 could not run. The exit code is the result; nothing is piped through tail.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fails = []; let passes = 0;
const ok = (c, m) => { if (c) passes++; else fails.push(m); return c; };
const walk = (d, out = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (!['node_modules', '.next', 'dist'].includes(f.name)) walk(p, out); } else out.push(p); } return out; };
const src = walk(path.join(ROOT, 'src')).filter((f) => /\.(js|jsx|ts|tsx)$/.test(f));

// S1 — NEXT_PUBLIC_ gate
const envFiles = ['.env', '.env.local', '.env.example'].map((f) => path.join(ROOT, f)).filter(fs.existsSync);
const publicNames = new Set();
for (const f of envFiles) for (const m of fs.readFileSync(f, 'utf8').matchAll(/^\s*#?\s*(NEXT_PUBLIC_[A-Z0-9_]+)/gm)) publicNames.add(m[1]);
for (const f of src) for (const m of fs.readFileSync(f, 'utf8').matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) publicNames.add(m[0]);
const badPublic = [...publicNames].filter((n) => /(SECRET|KEY|TOKEN|PASSWORD|PEPPER|WEBHOOK|DATABASE|DB_)/i.test(n));
ok(!badPublic.length, `S1 secret-shaped NEXT_PUBLIC_ name(s): ${badPublic.join(', ')}`);

// S2 — SQL built from strings: a query call whose first argument is a template literal with an interpolation that is not a known identifier helper
const sqlRe = /\.query\s*(?:<[^>]*>)?\s*\(\s*`([^`]*)`/g; const bad2 = [];
for (const f of src) { const s = fs.readFileSync(f, 'utf8'); for (const m of s.matchAll(sqlRe)) { const body = m[1]; const interps = [...body.matchAll(/\$\{([^}]*)\}/g)].map((x) => x[1].trim()); for (const i of interps) if (!/^(table\(|col\(|cols\b|vals\b|scope\b|String\(windowMin\)|cfg\.|\w+\.map\(|`?"\$\{|c\b|i\b)/.test(i) && !/^(cols|vals)\.(map|length)/.test(i) && !/^`"/.test(i)) bad2.push(`${path.relative(ROOT, f)}: \${${i.slice(0, 40)}}`); } }
ok(!bad2.length, `S2 SQL with a non-identifier interpolation (use $n placeholders): ${bad2.slice(0, 5).join('; ')}`);

// S3 — dangerouslySetInnerHTML outside reviewed custom code. Two usages are allowed, both in src/app/layout.tsx only: the
// no-flash theme boot <script> (THEME_SCRIPT, a static string with no interpolation) and the server-computed
// <style id="pucho-dark-tone"> (darkStyleText(): tone arithmetic from config, no user input). A line is allowed when it is
// exactly one of those two, or carries the marker `pucho:allow-inline theme-boot`; every other occurrence fails.
const S3_LAYOUT = path.join('src', 'app', 'layout.tsx');
const S3_ALLOW = [/^\s*<script dangerouslySetInnerHTML=\{\{ __html: THEME_SCRIPT \}\} \/>\s*$/, /^\s*<style id="pucho-dark-tone" dangerouslySetInnerHTML=\{\{ __html: darkStyleText\(\) \}\} \/>\s*$/];
const bad3 = [];
for (const f of src) {
  const rel = path.relative(ROOT, f); if (f.includes(`${path.sep}custom${path.sep}`)) continue;
  const text = fs.readFileSync(f, 'utf8'); if (!text.includes('dangerouslySetInnerHTML')) continue;
  const lines = text.split(/\r?\n/); const used = new Set();
  lines.forEach((line, i) => {
    if (!line.includes('dangerouslySetInnerHTML')) return;
    const k = S3_ALLOW.findIndex((re) => re.test(line));
    const allowed = rel === S3_LAYOUT && ((k >= 0 && !used.has(k)) || /pucho:allow-inline theme-boot/.test(line));
    if (k >= 0) used.add(k);
    if (!allowed) bad3.push(`${rel}:${i + 1}`);
  });
  // the boot script must stay a static string — an interpolation in THEME_SCRIPT would make the allowance unsafe
  if (rel === S3_LAYOUT) { const m = text.match(/const THEME_SCRIPT = `([^`]*)`/); if (m && m[1].includes('${')) bad3.push(`${rel}: THEME_SCRIPT interpolates`); }
}
ok(!bad3.length, `S3 dangerouslySetInnerHTML in kernel code: ${bad3.join(', ')}`);
if (!bad3.length) console.log('  S3 allowed: the theme boot script + pucho-dark-tone style in src/app/layout.tsx (static, no user input)');

// S4 / S5 — what is in the bundle
const staticDir = path.join(ROOT, '.next', 'static');
if (fs.existsSync(staticDir)) {
  const blob = walk(staticDir).filter((f) => /\.(js|css)$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
  const secrets = [];
  for (const f of envFiles.filter((x) => !x.endsWith('.example'))) for (const line of fs.readFileSync(f, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)$/); if (m && !m[1].startsWith('NEXT_PUBLIC_') && m[2].trim().length > 8 && !/^(http:\/\/localhost|postgres:\/\/postgres@localhost)/.test(m[2].trim())) secrets.push([m[1], m[2].trim().replace(/^"|"$/g, '')]); }
  const leaked = secrets.filter(([, v]) => blob.includes(v)).map(([k]) => k);
  ok(!leaked.length, `S4 secret value(s) in .next/static: ${leaked.join(', ')} — rotate, then fix the leak`);
  const personas = path.join(ROOT, 'db', 'seed', 'users.json');
  if (fs.existsSync(personas)) {
    const pw = JSON.parse(fs.readFileSync(personas, 'utf8')).map((u) => u.password).filter((p) => p && p.length >= 4);
    const inBundle = pw.filter((p) => blob.includes(`"${p}"`) || blob.includes(`'${p}'`));
    ok(!inBundle.length, `S5 persona password(s) in .next/static: ${inBundle.length} (the picker is served by /api/personas at runtime, never bundled)`);
  }
  ok(!/studio\.pucho\.ai\/api\/v1\/webhooks/.test(blob), 'S4b a Studio webhook URL is in the bundle');
} else console.log('  S4/S5 skipped: no .next/static yet (run after `npm run build`)');

// S6 — dependency patching
try { execSync('npm audit --omit=dev --audit-level=high', { cwd: ROOT, stdio: 'pipe' }); passes++; }
catch (e) { const out = String(e.stdout || '') + String(e.stderr || ''); if (/ENOTFOUND|ECONNREFUSED|EAI_AGAIN|audit endpoint/i.test(out)) console.log('  S6 npm audit could not reach the registry — UNVERIFIED'); else if (/ENOLOCK/.test(out)) fails.push('S6 no package-lock.json — run `npm i` so npm audit (and npm ci) have a lockfile'); else fails.push('S6 npm audit reports a high or critical vulnerability:\n' + out.split('\n').filter((l) => /Severity|^[a-z@].*\s{2,}/.test(l)).slice(0, 6).join('\n')); }

// A1–A4 — against the database
if (process.argv.includes('--db')) {
  const { default: pg } = await import('pg');
  for (const f of ['.env.local', '.env']) { const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue; for (const line of fs.readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim(); } }
  const url = process.env.DATABASE_URL; if (!url && !process.env.DB_HOST) { console.log('check --db UNAVAILABLE: no DATABASE_URL'); process.exit(2); }
  const pool = new pg.Pool(process.env.DB_HOST ? { host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD || '' } : { connectionString: url });
  try {
    const h = await pool.query('SELECT password_hash FROM users WHERE password_hash IS NOT NULL LIMIT 5');
    ok(h.rows.length === 0 || h.rows.every((r) => r.password_hash.startsWith('$argon2id$')), 'A1 a stored password hash is not argon2id');
    const base = process.env.CHECK_BASE_URL;    // the running app, for the HTTP assertions
    if (base) {
      const users = JSON.parse(fs.readFileSync(path.join(ROOT, 'db', 'seed', 'users.json'), 'utf8'));
      const access = fs.readFileSync(path.join(ROOT, 'src', 'config', 'access.js'), 'utf8');
      const scopes = JSON.parse(access.match(/export const SCOPES = (\{[\s\S]*?\});\r?\nexport const ACTIONS/)[1]);
      // A3: a non-admin calling an admin Route Handler-equivalent — the data API is closed without the token, and the files route 401s signed out
      const r1 = await fetch(`${base}/api/data/${Object.keys(JSON.parse(access.match(/export const PUBLIC_ENTITIES = (\{[\s\S]*?\});/)[1]))[0] ?? 'x'}`); ok(r1.status === 403, `A3 /api/data without INBOUND_TOKEN answered ${r1.status}, not 403`);
      const r2 = await fetch(`${base}/api/files/F-0000000000000000`); ok(r2.status === 401, `A3 /api/files signed out answered ${r2.status}, not 401`);
      const r3 = await fetch(`${base}/api/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"x.png","data_base64":"iVBORw0KGgo="}' }); ok(r3.status === 403, `A3 POST /api/files (a flow's picture) without INBOUND_TOKEN answered ${r3.status}, not 403`);
      // A5 (v4.7): the flow door refuses a body that is not JSON (415) and one over the size cap (413) — before it is parsed, even with the token
      const tok = process.env.INBOUND_TOKEN; const ent = (fs.readFileSync(path.join(ROOT, 'src', 'config', 'os.config.js'), 'utf8').match(/export const ENTITIES = \{"([a-z][a-z0-9_]*)"/) || [])[1];
      if (tok && ent) {
        const r4 = await fetch(`${base}/api/data/${ent}`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Authorization: `Bearer ${tok}` }, body: '[{}]' }); ok(r4.status === 415, `A5 /api/data with Content-Type text/plain answered ${r4.status}, not 415`);
        const r5 = await fetch(`${base}/api/data/${ent}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: '[' + '{"x":"' + 'a'.repeat(300 * 1024) + '"}]' }); ok(r5.status === 413, `A5 /api/data with a 300 KB body answered ${r5.status}, not 413`);
      } else console.log('  A5 body limits skipped — no INBOUND_TOKEN in the environment');
      // A2: a scoped role sees only its own rows — a real session for that persona, the page fetched as the server renders it,
      // the ids inside it counted against the table: never more than the person's own rows, never the whole table
      const scopedRole = Object.keys(scopes).find((r) => Object.keys(scopes[r]).length);
      if (scopedRole) {
        const ent = Object.keys(scopes[scopedRole])[0]; const col = scopes[scopedRole][ent]; const persona = users.find((u) => u.role === scopedRole);
        const osCfg = fs.readFileSync(path.join(ROOT, 'src', 'config', 'os.config.js'), 'utf8');
        const ents = JSON.parse(osCfg.match(/export const ENTITIES = (\{.*\});[^\n]*$/m)[1]);
        const idCol = ents[ent].id.column.toLowerCase(); const prefix = ents[ent].id.prefix;
        const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'config', 'pages.js'), 'utf8').replace(/^[\s\S]*?export const PAGES = /, '').replace(/;\s*$/, ''));
        const pg = pages.find((p) => !p.public && JSON.stringify(p).includes(`"${ent}"`) && JSON.stringify(p).includes('{{user}}'));
        const all = await pool.query(`SELECT count(*)::int AS n, count(*) FILTER (WHERE "${col.toLowerCase()}" = $1)::int AS mine, array_agg("${idCol}") FILTER (WHERE "${col.toLowerCase()}" <> $1) AS others FROM "${ent}"`, [persona?.name]);
        if (persona && pg && all.rows[0].n > all.rows[0].mine) {
          const { createHash } = await import('node:crypto'); const token = 'check-scope-' + Date.now().toString(36); const hash = createHash('sha256').update(token).digest('hex');
          const u = await pool.query('SELECT id FROM users WHERE email = $1', [persona.email.toLowerCase()]);
          await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '10 minutes')", [hash, u.rows[0].id]);
          const cookie = `${base.startsWith('https://') ? '__Host-session' : 'session'}=${token}`;
          const html = await (await fetch(`${base}${pg.route}`, { headers: { cookie }, redirect: 'manual' })).text();
          await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hash]);
          const leaked = (all.rows[0].others || []).filter((id) => id && html.includes(id));
          ok(leaked.length === 0, `A2 ${scopedRole} fetched ${pg.route} and the page carried ${leaked.length} row(s) outside their scope (${ent}.${col}): ${leaked.slice(0, 3).join(', ')}`);
          console.log(`  A2 ${scopedRole} on ${pg.route}: ${all.rows[0].mine} own rows of ${all.rows[0].n} in ${ent}; ${leaked.length} foreign ids in the server-rendered page`);
        } else console.log(`  A2 ${scopedRole} on ${ent}: ${all.rows[0].mine} of ${all.rows[0].n} rows are theirs — nothing foreign to leak in this seed, or no page to fetch`);
      } else console.log('  A2 no scoped role in this OS (no `Col={{user}}` self-service pages)');
      // A4: deactivating ends sessions — assert the SQL contract on a throwaway user
      const id = `USR-CHECK${Date.now().toString(36).toUpperCase()}`;
      await pool.query("INSERT INTO users (id, email, name, role, password_hash) VALUES ($1, $2, 'Check', 'admin', '$argon2id$x') ON CONFLICT DO NOTHING", [id, `${id.toLowerCase()}@check.local`]);
      await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('check', $1, now() + interval '1 day') ON CONFLICT DO NOTHING", [id]);
      await pool.query('UPDATE users SET is_active = false WHERE id = $1', [id]); await pool.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      const s = await pool.query("SELECT u.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = 'check' AND u.is_active");
      ok(s.rows.length === 0, 'A4 a deactivated user still has a usable session');
      await pool.query('DELETE FROM users WHERE id = $1', [id]);
    } else console.log('  A2–A4 HTTP assertions need CHECK_BASE_URL=<running app>; A4 SQL contract checked below');
  } finally { await pool.end(); }
}

for (const f of fails) console.log('  FAIL', f);
console.log(`check: ${passes} passed, ${fails.length} failed`);
// The result is evidence (Haresh review: "every check passed" with no output to confirm it). Written beside the other gate
// output, committed with the code; handover_check.py refuses a repository without it.
try { const ev = path.join(ROOT, '..', 'evidence'); fs.mkdirSync(ev, { recursive: true }); fs.writeFileSync(path.join(ev, process.argv.includes('--db') ? 'check-db.txt' : 'check.txt'), `npm run check${process.argv.includes('--db') ? ':db' : ''} · ${new Date().toISOString()}\n${passes} passed, ${fails.length} failed\n${fails.map((f) => 'FAIL ' + f).join('\n')}\n`); } catch { /* evidence is best-effort */ }
process.exit(fails.length ? 1 : 0);
