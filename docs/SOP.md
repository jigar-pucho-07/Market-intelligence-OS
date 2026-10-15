# SOP · Market Intelligence — this app's application of the full-stack standard (§18)

1. **The system in one picture** — Browser → Next.js (one process: Server Components read, Server Actions write, Route Handlers `/api/*` for flows and health) → PostgreSQL (`6` entity tables + users/sessions/otp_codes/files/jobs) ; Pucho AI Studio flows (MARKET_REPORT, BROADCAST, MARKET_ANALYSE, MARKET_STORE, MARKET_PUBLISH) called from the server and writing back through `/api/data`. Rules live in `os.yaml` (the kernel computes KPIs, due, stages from it); nothing is a hand-written page.
2. **Environments** — dev: `DATABASE_URL`, port 3000, `APP_ORIGIN=http://localhost:3000` · prod: CP Portal injects `DB_*`, `PORT`; health check `/api/ping`.
3. **Secrets** — `AUTH_PEPPER`, `WEBHOOK_<FLOW>` ×5, `WEBHOOK_AUTH_OTP`, `INBOUND_TOKEN`, `DB_PASSWORD`. Never in the repo or the bundle (`npm run check`).
4. **Database** — `docs/db-setup.md`; tables in `docs/05-schema.md`; no `ON DELETE CASCADE` on client data (users are deactivated, never deleted; sessions cascade from users by design).
5. **Build and release** — `npm run check` (gate) · `npm run build` · `npm run package` (CP Portal bundle) · `npm run db:migrate` (idempotent).
6. **Deployment** — CP Portal, uploaded bundle, `node server.js`, `PORT` from the portal (default 80), health `/api/ping`.
7. **Where things go** — rules: `os.yaml` → `src/config/*`; DAL `src/lib/dal.ts`; Server Actions `src/app/actions.ts`; flow seam `src/lib/flows.ts` + `src/app/api/data`; auth `src/lib/auth.ts`.
8. **Standing risks** — see `docs/security.md` Known-broken.
9. **Required fields** — `app/.env.example`.
10. **Deploy-ready** — `docs/db-setup.md` smoke list; `evidence/` holds the gate output.
11. **Security posture** — `docs/security.md`.
