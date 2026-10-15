# Security · Market Intelligence (standards/fullstack-build-standard.md §19 — seven controls, every build)

| control | in this build | proof |
|---|---|---|
| 19.1 transport | HTTPS at CP Portal's proxy; `APP_ORIGIN` https:// turns on HSTS + `__Host-` cookie; DB TLS derived from the host and **verified** only when `DB_SSL_CA` is set; DB port never public; `app` / `studio_reader` roles (`db/roles.sql`) | startup log line; `curl -I`; `db:migrate` output |
| 19.2 passwords & sessions | argon2id (`$argon2id$`, 19 MiB / 2 / 1); opaque 32-byte token, SHA-256 in `sessions`, HttpOnly/Secure/Lax cookie, 30-day cap, revoked on deactivation / password change / role change; sign-in rate-limited per account and address; one-time codes HMAC-peppered, 10 min, 5 attempts; nothing in localStorage | `npm run check:db` A1, A4; devtools |
| 19.3 authorization | every page: `requireUser` + role → page map in the Server Component; every Server Action: role → action map (`src/config/access.js`); self-service roles pinned server-side (SCOPES); DTOs only; cross-scope row = 404 | `ui_check` R1; `check:db` A2–A3 |
| 19.4 input | `$n` placeholders everywhere (`npm run check` S2); Zod `.strict()` on every action, route and env; uploads by magic bytes into PostgreSQL, served through an authorised route | `npm run check` |
| 19.5 secrets | `import 'server-only'` on db/dal/auth/crypto/flows; no secret-shaped `NEXT_PUBLIC_`; `.next/static` searched for every `.env` value and every persona password; webhook URLs only in `WEBHOOK_<FLOW>` | `npm run check` S1, S4, S5; `security_scan.py` |
| 19.6 headers & patching | CSP, nosniff, DENY, referrer, permissions in `next.config.js`; `poweredByHeader: false`; `npm audit --audit-level=high` in the gate | `curl -I`; `npm run check` S6 |
| 19.7 PII encryption | no column declared `encrypted:` — if this OS stores Aadhaar / PAN / bank / health data, declare it on the entity before go-live | `psql` shows `v1:…` ciphertext |

## Workflows
Flows never hold a database credential. They write through `POST/PATCH /api/data/<entity>` with `INBOUND_TOKEN` (unset = 403), under the same DAL rules and audit as a person's request; they read reports with the read-only `studio_reader` role (D4). The app calls a flow through `WEBHOOK_<FLOW>` from the server; until a URL is set the app applies the action's declared effect itself and says **simulated** in the header — a demo is usable before any import, and nothing pretends an AI step ran.
Declared flows: MARKET_REPORT, BROADCAST, MARKET_ANALYSE, MARKET_STORE, MARKET_PUBLISH.

## Known-broken until step 7 proves otherwise (write the date when each is closed)
- [ ] `DB_SSL_CA` set and the startup line reads *ssl verified* (a Pucho DB CA bundle — ask the portal team).
- [ ] `app` and `studio_reader` roles created on the client database (needs a user that may create roles; else record the gap).
- [ ] An inbound token set on both sides — `INBOUND_TOKEN_<FLOW>` per flow (preferred) or the shared `INBOUND_TOKEN` — in the app's environment and in each flow's constants node.
- [ ] `WEBHOOK_AUTH_OTP` wired (until then the login page offers no one-time code; codes are never logged).

## Inbound tokens — one per flow, rotated without downtime (S8)
The app accepts `INBOUND_TOKEN` (shared), `INBOUND_TOKEN_<FLOW>` (one per flow — the audit row names which one let the write in,
so a leaked token points at one flow and one flow can be cut off by unsetting its variable) and `INBOUND_TOKEN_NEXT` (the incoming
token during a rotation). **Rotation:** 1. set `INBOUND_TOKEN_NEXT` to a new value (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`) and restart; 2. paste the new value into each flow's constants node in Studio and publish; 3. move the value to
`INBOUND_TOKEN` / `INBOUND_TOKEN_<FLOW>` and unset `INBOUND_TOKEN_NEXT`; restart. Every Studio webhook URL is itself a secret: it is
held only in the server environment (`WEBHOOK_<FLOW>`), never in the bundle or a flow file; rotate it by re-publishing the flow and
updating the variable. Audit trail: `audit_log` rows from a flow carry `flow [INBOUND_TOKEN_<FLOW>]` as the actor.
- [ ] First real deploy on CP Portal with the bundle from `npm run package` (the portal's upload contract is unverified — Q1 in `method/os-decisions.md` P-decisions).
