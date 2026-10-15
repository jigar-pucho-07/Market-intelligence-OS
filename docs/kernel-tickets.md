# Kernel tickets — defects in the pucho-os 4.9 kernel found by this build

These live in the skill's `templates/app`, not in this repository's own files. Per SKILL.md contract rule 6 and
`method/skill-update.md`, a kernel fix is made in the skill and re-gated on every worked example (`skill_gate.py compare` =
KEEP). Each ticket has the evidence that proves it. Where this OS can mitigate one in `os.yaml` or `src/custom/**`, the
mitigation is listed.

| # | where (generated file) | defect | evidence | severity here | mitigation in this OS |
|---|---|---|---|---|---|
| K1 | `app/scripts/check.mjs:22` + `src/module/Fields.jsx` | S1 regex `DB_` flags `NEXT_PUBLIC_DB_TIMEZONE` (value `Asia/Kolkata`, not a secret) | `npm run check` → 6 passed, 1 failed | false positive | none possible without editing a generated file; recorded |
| K2 | `src/app/actions.ts:106` | a `direct: patch` writes any column of the entity, not only the modal's declared fields | db review: analyst patch `{Status: Sent, Sent_Count: 9999}` → ok | MAJOR (signed-in analyst only) | the stage machine still applies (Ready→Sent is a legal move); routed to security audit 8b |
| K3 | `src/lib/validate.ts:73`, `src/lib/dal.ts:50` | phones stored and compared raw: `+91 98765 43210`, `9876543210` and `+919876543210` are three "unique" values | db review | MAJOR (duplicate WhatsApp to one person) | help text on the field asks for `+91…`; BROADCAST plan normalises before sending (workflow) |
| K4 | `src/lib/validate.ts` / `db/schema.sql` | status values not checked on insert; no DB CHECK on the status column | db review: subscriber `Deleted`, report `Draft` accepted | MAJOR | **fixed in os.yaml**: `Status: { one_of: [...] }` on reports, subscribers, deliveries |
| K5 | `src/lib/flows.ts:44-66` | simulated `effect`: no `today` value for a date column (`now` is UTC); `insert` cannot upsert; a status action cannot write a second entity | db review: simulated Run had no Report_Date; Re-run left the row Failed; Send never wrote published_reports | MAJOR (simulation only) | **os.yaml**: `Report_Date: now`, a separate `rerun` action that patches; published copy only from the real BROADCAST flow (said in the UI: SIMULATED) |
| K6 | `src/app/api/data/[entity]` | the flow door accepts any entity for any flow token: forged `audit_log` rows (201), PATCH of audit rows, `?mode=replace` can empty any table; a flow's `writes:` is not enforced | db review | MAJOR | one `INBOUND_TOKEN_<FLOW>` per flow; routed to security audit 8b |
| K7 | seed generator | `published_reports` rows copied from Ready/Failed reports; deliveries given dates of other reports | db review: 8/14, 30/32 | MINOR (demo data) | **os.yaml**: `seed: 0` on both; hand-written examples |
| K8 | `src/app/api/data` | no `Content-Type` → accepted (201), not 415 | db review | MINOR | — |
| K9 | `/api/jobs/<id>` | any signed-in role can read any job | db review | MINOR | — |
| K10 | `app/scripts/check.mjs` | exits 127 on Windows after printing its result | db review | MINOR (gate tooling) | the printed summary is the evidence |
| K11 | `scripts/scaffold_os.py:2022` (skill) | `r.startswith(("src/custom", …))` compares a Windows path (`src\custom\index.js`) with forward slashes, so on Windows the authored `src/custom/index.js` is copied over and hashed as generated on every scaffold | re-scaffold refused: "app\src\custom\index.js edited by hand" | MAJOR on Windows (custom registry wiped) | re-scaffold with `--overwrite-drift`, then `git show <prev>:app/src/custom/index.js` back; fix = `r.replace(os.sep, "/")` in the kernel |
| K12 | `src/module` shell (Powered-by badge) | the floating "Powered by" badge overlaps row content on desktop and mobile | qaqc screenshots 15 Oct (Subscribers, Pipeline, Deliveries, /me/reports) | MINOR (UX) | `design.powered_by: false` |
| K13 | header (`src/components/Header*`) | page titles truncate on a 390 px phone ("Today's …", "Subscri…") because the search box keeps its width | qaqc mobile screenshots | MINOR (UX) | none without a kernel change |
| K14 | `src/lib/flows.ts` | the app cannot send a per-flow secret header to a webhook; every generated flow is `auth: none` | audit SA-01..04 | HIGH in every kit-built OS | per-flow secret carried as `?k=` in `WEBHOOK_<FLOW>`, checked first in each flow; leaks into Studio run history (SA-20) — kernel fix: `X-Pucho-Flow-Secret` from `WEBHOOK_SECRET_<FLOW>` |
| K15 | `src/lib/flows.ts` (job error text) | a failed call stores the error text, which contains the webhook URL (and so the `?k=` secret), in `jobs.result` | audit SA-20 | MEDIUM | Owner action: restrict job reads (K9); rotate a secret if a job row ever shows a URL |
| K16 | `src/app/api/data/[entity]` PATCH | filters only on the id; extra `?Col=eq.v` conditions are ignored, so a conditional "claim" is impossible | workflow agent; audit SA-22 | LOW here | retry cap 3 + DB CHECK bounds the damage |
| K17 | `src/screens/LoginPage.jsx:91` | open redirect: `?next=` is pushed unchecked after sign-in | audit SA-07 (observed) | MEDIUM | none without a kernel change; Owner action: report to the kit owners |
| K18 | `src/app/actions.ts:209` uploadFile | any signed-in role (subscriber included) can upload files though no page has a file field | audit SA-08 | MEDIUM | none without a kernel change |
| K19 | `db/roles.sql:9` | `studio_reader` gets SELECT on every entity incl. subscribers and audit_log | audit SA-10 | MEDIUM | Owner action: do not create a `studio_reader` login (no flow uses it) |
| K20 | `src/app/actions.ts:19` | password minimum 8 (§19.2 says 12); admin reset not audited | audit SA-14 | LOW | Owner action: org password policy ≥ 12 |
| K21 | `src/instrumentation-node.ts:10` | the DEMO_LOGINS refusal checks only `DB_HOST`, not `DATABASE_URL` | audit SA-17 | LOW | Owner action: never set DEMO_LOGINS in production |
