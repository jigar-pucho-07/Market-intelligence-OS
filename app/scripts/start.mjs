#!/usr/bin/env node
// scripts/start.mjs — `npm start`: run the STANDALONE build exactly the way CP Portal runs it (`node server.js`), never
// `next start`, which does not serve an `output: standalone` build (audit S11, Oct 2026). Steps: copy .next/static, public/
// and db/ beside the standalone server (the tracer leaves them outside), load .env / .env.local into the environment the way
// the portal injects its fields (the standalone server reads no .env itself), bind to 127.0.0.1 unless HOSTNAME says
// otherwise (a demo server with DEMO_LOGINS=true must not answer the whole Wi-Fi — S3), then start it. The DEMO_LOGINS ×
// DB_HOST refusal lives in src/instrumentation-node.ts, so it holds for the portal's `node server.js` as well (S4).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SA = path.join(ROOT, '.next', 'standalone');
if (!fs.existsSync(path.join(SA, 'server.js'))) { console.error('npm start: no standalone build — run `npm run build` first'); process.exit(2); }
// Next's standalone output mirrors the project path when the workspace root is widened (TURBOPACK_ROOT); find server.js wherever it landed.
const serverDir = (() => { const direct = path.join(SA, 'server.js'); if (fs.existsSync(direct)) return SA; const stack = [SA]; while (stack.length) { const d = stack.pop(); for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isFile() && f.name === 'server.js') return d; if (f.isDirectory() && f.name !== 'node_modules') stack.push(p); } } return SA; })();
for (const [src, dst] of [[path.join(ROOT, '.next', 'static'), path.join(serverDir, '.next', 'static')], [path.join(ROOT, 'public'), path.join(serverDir, 'public')], [path.join(ROOT, 'db'), path.join(serverDir, 'db')]]) {
  if (!fs.existsSync(src)) continue;
  fs.rmSync(dst, { recursive: true, force: true }); fs.cpSync(src, dst, { recursive: true });
}
for (const f of ['.env.local', '.env']) {        // the same files Next.js reads, in the same order of precedence
  const p = path.join(ROOT, f); if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/\s+#.*$/, '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim(); }
}
process.env.HOSTNAME ??= '127.0.0.1';
process.env.PORT ??= '3000';
console.log(`standalone server → http://${process.env.HOSTNAME}:${process.env.PORT}  (DEMO_LOGINS=${process.env.DEMO_LOGINS ?? 'unset'})`);
process.chdir(serverDir);
await import(pathToFileURL(path.join(serverDir, 'server.js')).href);
