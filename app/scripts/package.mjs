#!/usr/bin/env node
// scripts/package.mjs — the CP Portal bundle (decision D3: the portal runs an uploaded bundle on its own Node, no
// Dockerfile). `next build` with output 'standalone' gives server.js + a traced node_modules; this script adds the static
// assets, public/, db/ and the start script, inspects the archive for .env, and zips dist/<slug>-portal.zip.
// The exact upload shape the portal accepts is UNVERIFIED until the first real deploy (open question Q1) — this is the most
// portable shape: `node server.js`, reads PORT (falls back to 80), zero install.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execSync } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
let sa = path.join(ROOT, '.next', 'standalone');
if (!fs.existsSync(path.join(sa, 'server.js'))) {   // a build made with TURBOPACK_ROOT widened (the skill gate) mirrors the project path
  const find = (d, depth) => { if (depth > 10) return null; if (fs.existsSync(path.join(d, 'server.js')) && fs.existsSync(path.join(d, '.next'))) return d; for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const r = find(path.join(d, e.name), depth + 1); if (r) return r; } return null; };
  sa = fs.existsSync(sa) ? find(sa, 0) : null;
  if (!sa) { console.error('no .next/standalone/server.js — run `npm run build` first'); process.exit(2); }
}
const out = path.join(ROOT, 'dist', 'portal'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
fs.cpSync(sa, out, { recursive: true });
fs.cpSync(path.join(ROOT, '.next', 'static'), path.join(out, '.next', 'static'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), path.join(out, 'public'), { recursive: true });
fs.cpSync(path.join(ROOT, 'db'), path.join(out, 'db'), { recursive: true });
if (!process.argv.includes('--demo')) fs.rmSync(path.join(out, 'db', 'seed', 'users.json'), { force: true });   // persona accounts travel only in a --demo bundle (the tracer copies the file too)
fs.cpSync(path.join(ROOT, 'scripts', 'db.mjs'), path.join(out, 'scripts', 'db.mjs'));
fs.writeFileSync(path.join(out, 'start.sh'), '#!/bin/sh\n# CP Portal entrypoint: PORT is injected by the portal (default 80); the DB_* block too.\nexport PORT="${PORT:-80}"\nexport HOSTNAME="0.0.0.0"\nexec node server.js\n');
fs.chmodSync(path.join(out, 'start.sh'), 0o755);
fs.writeFileSync(path.join(out, 'PORTAL-README.md'), `# ${pkg.name} — CP Portal bundle\n\nStart: \`node server.js\` (or \`./start.sh\`). Reads PORT (default 80), DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD/DB_SCHEMA, APP_ORIGIN, AUTH_PEPPER, WEBHOOK_* and INBOUND_TOKEN from the environment.\nBefore the first start: \`node scripts/db.mjs migrate\` against the portal's database (idempotent), then \`node scripts/db.mjs user <email> <name> admin\` for the first administrator. Never seed personas on a client database.\nSmoke: /api/ping → {"ok":true} · /api/health → database reachable · / → sign-in.\n`);
// Next's standalone tracer copies the project's .env files beside server.js; the bundle must not carry them (standards §4) —
// the portal injects the environment. Strip every .env* except .env.example, then prove none is left.
(function strip(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== 'node_modules') strip(p); } else if (/^\.env(\..*)?$/.test(f.name) && f.name !== '.env.example') fs.rmSync(p); } })(out);
const leaks = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/^\.env(\..*)?$/.test(f.name) && f.name !== '.env.example') leaks.push(p); } })(out);
if (leaks.length) { console.error(`REFUSED: .env inside the bundle: ${leaks.map((l) => path.relative(out, l)).join(', ')}`); process.exit(1); }
const zip = path.join(ROOT, 'dist', `${pkg.name}-portal.zip`); fs.rmSync(zip, { force: true });
try { execSync(`cd "${out}" && zip -qr "${zip}" .`, { stdio: 'inherit' }); console.log(`portal bundle: ${path.relative(ROOT, zip)} (${(fs.statSync(zip).size / 1048576).toFixed(1)} MB) — no .env inside; start with node server.js`); }
catch { console.log(`portal bundle folder: ${path.relative(ROOT, out)} (zip not available on this machine — upload the folder)`); }
