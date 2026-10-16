# Security audit — Market Intelligence · round 3 · 16 Oct 2026 · stage production · Known-broken 5/5

Summary: 0 critical · 3 high · 9 medium · 13 low · 20/25 open

**Open by severity:** 0 Critical · 0 High · 7 Medium · 13 Low. The production gate (0 Critical, 0 High OPEN) is **met**. It still rests on two Studio behaviours that nobody has checked on an import, and Owner action 1 must prove both. SA-24 is only partly fixed: the browser can still raise the admin alert, because the app lets a payload's `action` replace the authorised one (SA-19).

Auditor: a fresh read-only auditor (final re-audit, round 3 of 3). Inputs:
- The round-2 report (SA-01..SA-25).
- Fix commit `1bf8876` ("allow-list gate routers, row-derived broadcast intent, no secret echo"), which targets SA-20 (flow side), SA-21 and SA-24.
- The commits after it: `4c5577a` re-scaffold, `6e2e332` custom registry restore (K11), `f54d2ce` next-env, and `32e54fb` handover check REFUSED. In `app/src` only config changed: one `header` key in `pages.js`, plus the schema's date stamp. The kernel code is unchanged since round 1.
- `docs/kernel-tickets.md` K1–K23. There is no `docs/security-fixes.md`.
- `security_scan.py --stage production`: **1 C · 4 H · 12 M · 0 L** over 135 files and 7 flows. The result is identical to round 2, and the disposition is below.
- All seven flow JSON files, read router by router, with `tools/build_market_flows.py`, `app/src/custom/lib/market.js` and `market-flow.js`.
- `node --test tests/*.test.mjs`: **59/59 pass**. That includes the three new SA-20 and SA-21 structural tests.
- `npm audit --omit=dev`: 0 vulnerabilities.
- A node run of `sendPlan` with the exact body the app builds (scratch script, not committed).

Findings marked **observed** were checked against the local build (http://localhost:5000, a `*_dev` database, DEMO_LOGINS=true). Every other finding was confirmed by reading the code.

| ID | Severity | Area | Where (file:line / flow · step) | Finding | Exploit in one line | Fix | Status |
|----|----------|------|----------------------------------|---------|---------------------|-----|--------|
| SA-01 | High | workflows | `workflows/MARKET_STORE/MARKET_STORE.json` · `step_constants` → `step_auth`; `market.js:438` secretMatches, sanitizeReportRow | **Still fixed** (re-checked). `?k=` is compared in constant time and fails closed, which gives 401 before any read. The body row is re-checked with `isAdvice`, and the WhatsApp text is rebuilt. The router is now an allow-list (SA-21). Residual: whoever holds the secret chooses the row content (links not filtered, SA-25). | Without the secret: 401, nothing written. | Done. Verify on import (Owner action 1). | FIXED |
| SA-02 | High | workflows · credits | `workflows/MARKET_REPORT/MARKET_REPORT.json` · `step_constants` → `step_auth` → `step_read_reports` → `step_gate` → MARKET_ANALYSE | **Still fixed.** The order is secret, then action, then today's state, and only after that the hand-off to MARKET_ANALYSE. MARKET_ANALYSE re-checks its own secret before the five fetches and the llm-ai call. Residual: SA-23. | Without the secret: 401, 0 fetches, 0 model calls. | Done. Studio budget alert (Owner action 11). | FIXED |
| SA-03 | High | workflows · messaging | `workflows/BROADCAST/BROADCAST.json` · `step_router` | **Still fixed.** Each branch requires `gate = ok` (exact, case-sensitive) AND the action. `bad_action` gives 400, and anything else falls to the 401 fallback. Alert text comes only from the report row or the fixed `watchdogText`. Residual: SA-22 and SA-24. | Without the secret: 401, nothing sent. | Done. | FIXED |
| SA-04 | Medium | workflows | `workflows/MARKET_PUBLISH/MARKET_PUBLISH.json` · `step_constants` → `step_auth` | **Still fixed.** The secret is checked first, and the router is an allow-list. A report is published only when at least one delivery was Sent. | Without the secret: 401. | Done. | FIXED |
| SA-05 | Medium | app (kernel K6) | `app/src/app/api/data/[entity]/route.ts:29-87` | Unchanged. Any inbound token can write any entity, `audit_log` included, and `?mode=replace` can empty a table. **Observed:** without a token, and with a wrong bearer token, the door answers 403. | A copied flow token wipes `subscribers` or rewrites `audit_log`. | Kernel: map `INBOUND_TOKEN_<FLOW>` to that flow's `writes:`, refuse `audit_log`, and allow `mode=replace` only for a declared sync. | OPEN |
| SA-06 | Medium | app (kernel K2) | `app/src/app/actions.ts:106-129` | Unchanged. `direct:patch:reports` writes any column, Error_Message included, and that text becomes the admin alert text (see SA-24). | An analyst marks a report Sent with 9,999 deliveries, or writes the admin alert text. | Kernel: filter the patch to the modal's declared fields. | OPEN |
| SA-07 | Medium | app (kernel K17) | `app/src/screens/LoginPage.jsx:91` | Unchanged. After sign-in the app redirects to `?next=` without checking it. | `/login?next=https://look-alike.example/` sends a subscriber who has just signed in to a phishing page. | Accept only `^/(?![/\\])`; otherwise use `homeFor(role)`. | OPEN |
| SA-08 | Medium | app (kernel K18) | `app/src/app/actions.ts:209`; `app/src/app/api/files/[id]/route.ts:12` | Unchanged. Any signed-in role can upload and fetch any file, with no rate limit. | A subscriber fills the 400 MB cap and hosts files on the client's domain. | Allow it only for roles with a `type: file` field, rate-limit it, and scope file reads. | OPEN |
| SA-09 | Medium | data · DPDP | `os.yaml` subscribers; `app/src/lib/dal.ts:245` writeAudit | Unchanged. There is no erasure path. Contact values are copied into `audit_log.Summary`. There is no retention rule, no stored notice and no STOP handling. | An erasure request cannot be met, and the number survives in the audit log. | An admin "Erase subscriber" action, no contact columns in the audit summary, a retention rule, the notice version stored with the opt-in, and a STOP handler. | OPEN |
| SA-10 | Medium | data (kernel K19) | `app/db/roles.sql:9` | Unchanged (re-read). `studio_reader` has SELECT on all six entities, `subscribers` and `audit_log` included. No flow uses the postgres tool. | A leaked `studio_reader` login reads every subscriber's number. | Grant only what a flow reads, and here create no login (Owner action 8). | OPEN |
| SA-11 | Low | app (kernel K3) | `app/src/lib/validate.ts:73`, `app/src/lib/dal.ts:50` | Unchanged. Phone numbers are stored raw. BROADCAST normalises them only when it sends. | One person stored three ways gets three WhatsApps. | Normalise to E.164 before the uniqueness check. | OPEN |
| SA-12 | Low | app (kernel K9) | `app/src/app/api/jobs/[id]/route.ts:9-14` | Unchanged. Any signed-in role reads any job's `result`. **Observed:** anonymous → 401. | A subscriber who learns a job id reads a desk job's result, including a K15 URL (SA-20). | Scope GET to `requested_by` or to the roles allowed that flow action. | OPEN |
| SA-13 | Low | app (kernel K8) | `app/src/lib/auth.ts:209-219` | Unchanged. The flow door accepts a request with no Content-Type. | Token holders only. | Require `application/json`. | OPEN |
| SA-14 | Low | app (kernel K20) | `app/src/app/actions.ts:19` (`min(8)`); `:266` resetUserPassword; `app/scripts/db.mjs:107` (`Math.random`) | Unchanged (re-read). | Weaker against offline guessing; a password reset leaves no trace. | Minimum 12 characters; `writeAudit` on reset; `crypto.randomBytes`. | OPEN |
| SA-15 | Low | custom · compliance | `app/src/app/actions.ts:106` (Review edit); `market-flow.js:213` publishPlan | Partly fixed, as in round 2. Flow-written rows pass `isAdvice`, but text an analyst types in Review is never checked. MARKET_PUBLISH copies the stored columns to `published_reports` without a re-check. | An analyst's "Buy 22,000 CE" reaches the subscriber portal. | A server-side `isAdvice` and link check on the `reports` text columns; rebuild WhatsApp_Message on edit; re-check in publishPlan. | OPEN |
| SA-16 | Low | app (kernel, no ticket) | `app/src/module/DocumentPreview.jsx:23` | Unchanged. The `fill()` output is put into `<title>` unescaped. Latent: the only value is `{{Report_Date}}`. | No exploit today. | HTML-escape the `fill()` output. | OPEN |
| SA-17 | Low | app (kernel K21) | `app/src/instrumentation-node.ts:10` | Unchanged. The start-up refusal checks only `DB_HOST`. | A `DATABASE_URL` deployment starts with password-less persona sign-in. | Also refuse when `NODE_ENV=production` and the database host is not local. | OPEN |
| SA-18 | Low | app (kernel, no ticket) | `app/next.config.js:13`, `:29` | Unchanged (**observed** `curl -I /login`). `Permissions-Policy: camera=(), geolocation=()` leaves the microphone allowed, and `font-src` allows `data:`. | Hardening only. | `microphone=()`; `font-src 'self'`. | OPEN |
| SA-19 | Low | app (kernel, no ticket) | `app/src/app/actions.ts:86`, `:131-134`; `app/src/lib/flows.ts:106`, `:110` | Unchanged, and now **load-bearing**. The payload is `z.record(z.unknown())`. Only keys starting with `_` are stripped. `{ action, _who, _job, ...payload }` lets a payload `action` replace the authorised one. In round 2 this changed nothing, because both actions of each flow are granted to the same roles. Since `1bf8876`, BROADCAST answers a third action, `alert`, which no role holds, and this override reaches it (SA-24). | An analyst authorised for `BROADCAST.send` sends `{action:"alert"}` and runs the flow-only alert. | Spread the payload **before** `action`/`_who`/`_job` (or delete `action` from the body), and use a `.strict()` Zod schema per flow action. File a kernel ticket. | OPEN |
| SA-20 | Medium | workflows · secrets | `tools/build_market_flows.py:68-71`, `:110`; `app/src/lib/flows.ts:110` (K15), `:106-110` (K14) | **The flow side is fixed; the app side is open.** Verified: in all five webhook flows, `{{trigger['queryParams']['k']}}` is read by `step_constants` only (one reference per flow, structural test). No CODE step gets the trigger's query string. `step_constants` drops `webhook_secret` from its output. No Return, write or job template references `queryParams`, the URL, `{{trigger}}` or `{{step_constants}}`. `scrubSecrets` (`market.js:430`) now cleans fetch errors (`Source_Status`) and WhatsApp errors (`deliveries.Error_Message`). Two error texts are still not scrubbed, but neither carries a `?k=`: `doorError` (`market.js:423`, app read errors) and `finishReport` (`market-flow.js:42`, model error). **Still open, in the kernel:** the secret travels in the query string (K14), so it lands in Studio run history and in any access log on the path. And `flows.ts:110` still writes `String(e)`, which can include the full `WEBHOOK_*` URL with `?k=`, into `jobs.result`, which any signed-in role can read (SA-12, K15). No secret is in the repository: every `*_secret` and `inbound_token` constant is a `SET_IN_STUDIO_*` placeholder, and the only `k=` values are test fixtures. | Anyone who can read Studio run history or a log on the webhook path replays `?k=` and runs MARKET_REPORT or BROADCAST. | Kernel: a header secret (`X-Pucho-Flow-Secret`, K14), and store `e.name`, not `String(e)` (K15). Until then: Owner action 1 rotation, and limit who can read run history. | OPEN |
| SA-21 | Medium | workflows | `tools/build_market_flows.py:113-120` auth_router, `:280-286` BROADCAST router; MARKET_REPORT / MARKET_ANALYSE / MARKET_STORE / MARKET_PUBLISH · `step_auth` | **Fixed.** Verified in the JSON: each `step_auth` is `EXECUTE_FIRST_MATCH` with three branches. (1) "Authorised" when `gate` is `TEXT_EXACTLY_MATCHES 'ok'` (caseSensitive true), an empty branch, after which the flow continues. (2) `bad_action` → `step_bad_action_done` (400, `respond: stop`). (3) The **FALLBACK** → `step_denied_done` (401, `respond: stop`). A missing, empty, mis-cased or padded `gate` (a skipped or re-pasted first step) now stops at 401. BROADCAST does the same with `gate = ok` AND an exact action. `step_constants` has `continueOnFailure: false`, and `bad_action` is only possible after the secret has matched. **Residual (unverified Studio behaviour):** a `return_response` with `respond: stop` inside a router branch must end the run. The suggested `throw` in the CODE step was not adopted. | — | Done. On the first import send a wrong `?k=` to each flow and confirm in run history that it stopped at `step_denied_done` (Owner action 1). | FIXED |
| SA-22 | Low | workflows · app (kernel K16) | `market-flow.js:189` retryPlan; `build_market_flows.py:268-269`; `app/src/app/api/data/[entity]/route.ts:57-59` | Unchanged. The door ignores `?Attempts=eq.n`, so concurrent retries can each send. K16 is now filed. | Parallel Retry clicks give one subscriber several paid WhatsApps. | Kernel: honour the `eq.` filters on PATCH (409 when no row matches). | OPEN |
| SA-23 | Low | workflows · credits | `market-flow.js:71-81` reportGate | Unchanged. No row exists until MARKET_STORE writes it, about 45 s later, so a second run in that window pays again. Failed reruns are not capped. | Repeated "Run report now" clicks pay for the model each time. | Claim the day before the hand-off (a `Running` row or lock), and cap reruns. | OPEN |
| SA-24 | Low | workflows · messaging | `market-flow.js:133-141` sendPlan; `app/src/lib/flows.ts:110` (payload spread, SA-19); `build_market_flows.py:286` | **Partly fixed.** Fixed: `Kind` from the caller is never read, and a Ready or Sent report not of today is refused `NOT_TODAY` (checked by running it). **Still open (reproduced with the app's body shape in a node run):** (a) The app sends `{action:'send', _who, _job, ...payload}`. A payload `action:"alert"` with an empty `Report_ID` therefore reaches BROADCAST as `alert`, passes the allow-list, and `sendPlan` queues the false "no report row by 06:20" watchdog alert to every admin. That is one per admin per minute (`ADMIN-n-HHmm`), within the 200 actions a day. The commit's "no app role holds it" is not enforced (SA-19). (b) `send` with the Report_ID of a Failed report **of any date** also alerts every admin, with that row's analyst-editable Error_Message (SA-06). The text is cut to 160 characters and goes into an approved template. (c) A refused send still posts MARKET_PUBLISH, which re-publishes the stored copy of that report and marks the app's job `done`. That copy may have been edited after it was sent (SA-15). | An analyst spams every admin's WhatsApp with false "run failed" alerts, or with text the analyst typed into an old Failed report. | sendPlan: on `action === 'send'`, refuse a Failed report not of today, and treat a body `action` of `alert` as invalid unless `_who` starts with `flow:`. Better, fix SA-19 in the kernel so the authorised action cannot be replaced. Skip `step_send_publish` when `sendPlan.code` is set. | OPEN |
| SA-25 | Low | workflows · AI | `build_market_flows.py:44-45` (`gfn`, `global` unscoped searches); `market.js` ADVICE / parseModel / sanitizeReportRow | Unchanged. Links, domains and phone numbers are not filtered. With `auto_send: true` the text goes out at 06:00. | A planted headline gets a scam link into Driver_1 and on to every subscriber. | Treat URLs, domains and 10+ digit runs as removed text (fail the row on a hit in Driver_1). Owner action 14. | OPEN |

### Scanner findings — disposition (round 3 run: 1 C · 4 H · 12 M · 0 L; identical to round 2)

| scan | where | verdict |
|---|---|---|
| F4b Critical | `app/src/module/Fields.jsx` `NEXT_PUBLIC_DB_TIMEZONE` | **Rejected — false positive** (K1, K23). The value is an IANA zone name. |
| F5 High ×2 | `app/src/lib/validate.ts:117`, `:132` | **Rejected — false positive.** The match is the comment "WITHOUT eval()" (K23). |
| F5 Medium ×2 | `app/src/app/layout.tsx:51`, `:53` | **Rejected.** The static theme script (S3-allowed). |
| F14 High | `app/.env` INBOUND_TOKEN unset | **Configuration → Owner action 2.** **Observed:** the door answers 403 without a token and with a wrong one. |
| F3b High | `app/.env` DEMO_LOGINS=true | **Configuration → Owner action 3.** **Observed:** `/api/personas` lists the personas locally. The code weakness is SA-17. |
| F16 Medium ×5 | `app/.env` WEBHOOK_* unset | **Configuration → Owner action 9.** Only MARKET_REPORT and BROADCAST should be set. |
| W1 Medium ×5 | the five `catch_webhook` triggers (`authType: none`) | **Mitigated in the flow.** `?k=` is checked first, and the router is now an allow-list (SA-21 FIXED). What remains is SA-20. |

### What holds (spot-checked in round 3, no new finding)
- **The gate is first on every webhook path.** In MARKET_REPORT, MARKET_ANALYSE, MARKET_STORE and MARKET_PUBLISH the order is trigger → `step_constants` → `step_auth`, and only then a GET, fetch, llm or write. In BROADCAST it is trigger → `step_constants` → `step_router`, which carries the allow-list in every branch. The two schedule flows have no webhook.
- **Flow-to-flow calls** still carry the callee's secret through `queryParams.k`. Every secret is a placeholder.
- **Returns.** Every Return names its fields. None echoes the trigger, the constants or a whole step output. The 400 is reachable only after the secret matches, so a caller without the secret learns nothing about valid actions.
- **Unchanged kernel checks.** Identity comes from the session, the role→action map is checked server-side, the subscriber role holds no actions, and all SQL uses `$n` placeholders. Custom UI has no `innerHTML`, raw HTML, `href` or `window.open` (re-grepped). Security headers are **observed** (CSP, `X-Frame-Options: DENY`, nosniff, referrer policy). `/api/jobs` anonymous → 401 (**observed**). `npm audit`: 0.
- **Kernel tickets.** K14–K21 now cover SA-20, SA-22, SA-07, SA-08, SA-10, SA-14 and SA-17, which closes most of round 2's Owner action 15. SA-16, SA-18 and **SA-19** still have no ticket.

## Owner actions (a person must do these)
1. **Webhook secrets: first import (SA-01..SA-04, SA-20, SA-21).**
   - Generate one secret per webhook flow with `openssl rand -hex 24`. Paste each into that flow's `webhook_secret` and into every caller's `<flow>_secret`.
   - Set `WEBHOOK_MARKET_REPORT=<url>?k=<secret>` and `WEBHOOK_BROADCAST=<url>/sync?k=<secret>` in the CP Portal environment.
   - Then prove two behaviours on each of the five flows, from run history:
     - (a) a correct `?k=` reaches the code as `{{trigger['queryParams']['k']}}`;
     - (b) a wrong or missing `?k=` answers 401 **and the run stops at `step_denied_done`**, with no step after it.
   - If (b) fails, unpublish the flows until the CODE step `throw`s on a wrong secret.
   - Rotate every secret when anyone with Studio run-history access leaves, and whenever a `jobs.result` row shows a URL (K15).
2. **Inbound tokens.** Set `INBOUND_TOKEN_MARKET_REPORT`, `_BROADCAST`, `_MARKET_STORE`, `_MARKET_PUBLISH` and `_DAILY_WATCHDOG` in the CP Portal environment, with the same value in each flow's `inbound_token`. Confirm the start-up line reads `inbound: open`.
3. **DEMO_LOGINS.** Leave it unset in production and never run `db:seed` on the client database. Create the first admin with `npm run user:create`. Confirm `/api/personas` returns `{"personas":[]}`.
4. **`DB_SSL_CA`.** Set it, and confirm `ssl verified`. Keep port 5432 private.
5. **`AUTH_PEPPER`.** Set 32 random bytes in the portal environment. Do not reuse the local value.
6. **`APP_ORIGIN=https://<domain>`.** This turns on HSTS and the `__Host-` cookie. Check with `curl -I`.
7. **`TRUST_PROXY_HOPS=1`** behind CP Portal.
8. **Database roles.** Create the `app` login (`CREATE USER <login> … IN ROLE app`) and point `DB_USER` at it. Do **not** create a `studio_reader` login (SA-10).
9. **Webhook wiring.** Set only `WEBHOOK_MARKET_REPORT` and `WEBHOOK_BROADCAST`. Leave the other three unset. Put the flow-to-flow URLs and secrets in the constants as each CHECKLIST says.
10. **WhatsApp.** Get approval for templates `mi_daily_report` and `mi_run_failed`. Set the template ids, `whatsapp_account_id` and `alert_to`. Confirm that `pucho-whatsapp` belongs to a company account.
11. **AI connection and budget.** Confirm the OpenRouter `gpt-4o-mini` connection, and set a Studio budget or spend alert (SA-02, SA-23).
12. **DPDP (SA-09).** Publish a privacy notice and decide the retention periods. Until the erase action exists, handle each erasure by hand with SQL (the subscriber row, `subscriber_name` on deliveries, the `audit_log.summary` rows), and record each request.
13. **NSE holidays.** Fill the same `holidays` list into DAILY_SCHEDULE and DAILY_WATCHDOG.
14. **`auto_send: true` (MARKET_STORE).** Confirm in writing that commentary goes out at 06:00 with no human review (SA-15, SA-25), or set `false`.
15. **Kernel tickets still missing.** Add tickets to `docs/kernel-tickets.md` and route them to the skill's `templates/app`:
    - **SA-19:** the payload must not replace `action`, and each flow action needs a per-action `.strict()` schema. This is the root of SA-24's open part.
    - SA-16: the `document.write` escape.
    - SA-18: `microphone=()` and `font-src 'self'`.
16. **SA-24 interim.** Until SA-19 or the sendPlan fix ships, tell admins that a "run failed" WhatsApp with no matching Failed report today may be a false alert. Each one leaves an `ADMIN-n-HHmm` delivery row naming the time.
17. **Secret scanning.** Run `gitleaks` over the history once, and add it as a pre-commit hook.
18. **Handover.** `docs/handover.md` (32e54fb) is REFUSED. The gates must be re-run on the re-scaffolded build (ui_check, `npm run check`, security_scan evidence) before delivery. This is not a security finding, but the evidence is older than the build.

## Accepted risks
| ID | Why accepted | Accepted by | Date |
|----|--------------|-------------|------|
| — | none yet | — | — |

## Not covered
- **Studio behaviour** (no import was made):
  - whether `{{trigger['queryParams']['k']}}` resolves on a real catch_webhook;
  - whether `respond: stop` inside a router branch ends the run (SA-21's residual);
  - whether an empty "Authorised" branch continues to the step after the router;
  - LOOP_ON_ITEMS over a non-array;
  - whether a long send started through `/sync` keeps running;
  - run-history retention and who can read it;
  - workspace membership and connection ownership.
- **The live environment.** The CP Portal environment, the production database's roles, TLS and port, real HTTPS headers and cookies, and the access logs on the path to Studio (SA-20).
- **The flow door with a token** was not exercised: INBOUND_TOKEN is unset locally (403 observed). SA-05, SA-13 and SA-22 were read in code.
- **No Server Action, upload or retry was written to the dev database.** SA-24's override was reproduced by running `sendPlan` in node with the body `flows.ts` builds, not through a wired BROADCAST: `WEBHOOK_BROADCAST` is unset locally, so the app would simulate instead.
- **`npm run check` / `check:db`** were not re-run. The kernel code is unchanged since round 1, when the result was 6 passed and 1 failed (S1 = K1, false positive).
- **Outside services.** WhatsApp template-variable handling and STOP replies, OpenRouter data handling, and what the unscoped Google News searches return (SA-25).

Production gate: MET (0 Critical, 0 High OPEN)
