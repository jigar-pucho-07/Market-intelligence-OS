# Database setup (steps 3 and 7)
## Local (step 3)
```
createdb market_intel_os_dev            # or: psql -c "CREATE DATABASE market_intel_os_dev"
psql -d market_intel_os_dev -c "SELECT version();"   # prove you can reach it BEFORE touching the app
cd app && npm i && npm run db:migrate && npm run db:seed   # schema (twice-safe) + demo rows + demo personas
npm run build && npm start                     # http://localhost:3000 — sign in with a persona (Settings → Users & roles lists them)
```
## Client database (step 7 — Pucho DB through CP Portal)
1. The portal injects `DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD DB_SCHEMA`; set `APP_ORIGIN`, `AUTH_PEPPER`, every `WEBHOOK_<FLOW>` and `INBOUND_TOKEN` in its environment fields (never inside the upload).
2. From a machine that can reach the database: `node scripts/db.mjs migrate` (apply, then apply again — it must be idempotent), then `node scripts/db.mjs user <email> <name> admin` for the first administrator. **Never `db:seed` on a client database** — the personas are demo accounts.
3. `db/roles.sql` creates `app` (DML only) and `studio_reader` (SELECT on entity tables). If the portal hands over a single user that cannot create roles, the migrate script says so: record it in `docs/SOP.md` → Known-broken (§19.1).
4. Smoke: `/api/ping` → ok · `/api/health` → database reachable, workflows wired n/n · sign in.
