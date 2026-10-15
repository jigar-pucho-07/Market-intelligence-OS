# Data-layer review · Market Intelligence (database agent, 15 Oct 2026)

Scope: the generated data layer (`app/src/lib/{dal,validate,flows,auth}.ts`, `app/src/app/actions.ts`, `/api/data`, `db/*.sql`,
seed) checked against os.yaml. Nothing generated was edited. Re-run: `node tests/db/verify.mjs` (needs the app on
`CHECK_BASE_URL`, default http://localhost:5000, with `DEMO_LOGINS=true`). For the door cases, also set `DOOR_BASE_URL` and
`DOOR_TOKEN`: an instance of the same build started with `INBOUND_TOKEN` (the review used 127.0.0.1:5055, then stopped it).
The fixtures use year-2099 ids and dates, and the script deletes them when it finishes. Evidence is in `evidence/db/`.

## Result
`verify.mjs`: **89 PASS · 11 FAIL · 4 NOTE**. `check:db`: 11 passed, 1 failed (S1); with a token, 13 passed (A5 415/413 ok).
`validate_inputs` (door, token): 55/63 passed · 1 FAIL · 7 NOT RUN. Against :5000 it is UNVERIFIED (exit 2, no token).
`security_scan --stage production`: 1 Critical · 4 High · 4 Medium.

**What holds (design 1, 2 and most of 3):**
- A subscriber gets only `published_reports` and `news_articles`. Every desk route redirects to `/me`. The `/me` and
  `/me/reports` HTML and RSC payloads carry no reports-only field and no phone number. `readEntity`, writes and flows are all
  refused.
- An analyst cannot open `/activity` or `audit_log`, and cannot use any Users & roles action.
- The stage machines, `requires_on`, `one_of`, the numeric guards, `unique`/`unique_together` (409) and the simulated
  send/retry effects hold on both write paths.

## Findings (no BLOCKER)
| sev | where | failing scenario |
|---|---|---|
| MAJOR | `actions.ts:106` | `direct:patch:reports` writes **any** column of the entity, not only the modal's 7 fields. An analyst sends `{Report_ID, Status:"Sent", Sent_Count:9999}` and gets ok, so the report shows Sent although nothing was broadcast (3.6). Kernel ticket: limit a direct patch/insert to the modal's declared `fields`. |
| MAJOR | `validate.ts:73`, `dal.ts:50` | The phone format is checked on a normalised copy, but the value is **stored raw** and uniqueness compares the raw text. `+91 98765 43210` and `9876543210` are both accepted next to `+919876543210` (3.10). `resolveSend` sends all three to one number, so one person gets 3 WhatsApps. Kernel ticket: normalise to E.164 before the unique check and the write. |
| MAJOR | `validate.ts:192` | Status values are not checked on **insert**, and there is no DB CHECK on status. Subscriber `Status:"Deleted"` (3.13) and report `Status:"Draft"` through the door (4.8) are both accepted. The row is then stuck, because `transitions["Deleted"]` is `[]`. |
| MAJOR | `flows.ts:44-66` | Simulated `MARKET_REPORT.run` inserts with **Report_Date null** (3.16), so the new report never appears on Today. Simulated re-run with a `Report_ID` hits `ON CONFLICT DO NOTHING`: it answers ok "Ready" while the row stays Failed (3.17). Simulated `BROADCAST.send` never writes `published_reports` (3.20), so `/me` never shows a report the desk sent. |
| MAJOR | seed | 8 of the 14 `published_reports` rows are copies of **Ready or Failed** reports, so a subscriber reads a report for a day whose run failed (1.4). Also, 30 of 32 deliveries have a `Report_Date` that differs from their report's date. |
| MAJOR | `api/data/[entity]/route.ts:45` | The door accepts writes to `audit_log`: a forged row is 201 (4.17). By the same code path, a PATCH can rewrite audit rows and `?mode=replace` can empty any table, `audit_log` included. Each flow's `writes:` list is not enforced per token. |
| MINOR | `auth.ts:219` | A body with **no** Content-Type is accepted as JSON: 201 instead of 415 (4.2). |
| MINOR | `dal.ts:55` | A `unique_together` 409 names the field `Report_Date+Subscriber_ID+Kind`. `validate_inputs` FAILs on this, and the form cannot show it under a field. |
| MINOR | `api/jobs/[id]` | Any signed-in role, the subscriber included, can read any job's status and result. |
| MINOR | `db/rls.sql` | There are no policies and RLS is off (`SCOPES={}`), so the subscriber/desk split is enforced only in the app (`dal.canRead`). In dev the app connects as a superuser. `studio_reader` can SELECT `subscribers` (phone numbers) and `audit_log`. |
| MINOR | gates | `check.mjs` exits 127 on Windows (libuv assertion at exit) even though it printed the result. `validate_inputs` reuses one `Report_Date` across cases, so 7 report cases are NOT RUN; `verify.mjs` 4.4 and 4.10 cover them. |

**Door state:** `INBOUND_TOKEN` is unset, so the door is **closed**. It answers **403** `closed`, not 401, to a missing or wrong
token, before it reads the body.

**S1 / F4b `NEXT_PUBLIC_DB_TIMEZONE` is a false positive.** The value is an IANA zone name (default `Asia/Kolkata`) read in
`src/module/Fields.jsx:84`, not a secret. It matches only because of `DB_` in `scripts/check.mjs:22`. Fix it in the kernel:
allow-list the name, or rename it to `NEXT_PUBLIC_BIZ_TIMEZONE`.

**Other security_scan findings:**
- F5 at `validate.ts:117` and `:132` are false positives: the text is the comment "WITHOUT eval()".
- F14 (no `INBOUND_TOKEN`), F3b (`DEMO_LOGINS`) and F16 (2 flows not wired) are real for production.

## Proposed os.yaml changes (orchestrator)
1. Add `Status: { one_of: [...] }` to the `fields:` of `reports`, `subscribers` and `deliveries`. This closes the status
   MAJOR in the validator and adds a DB CHECK, through the grammar that already exists.
2. Set `published_reports.seed: 0`, which keeps only the two Sent examples, until the seed can derive published copies from
   Sent reports.
3. Add `Report_Date: now` to the `MARKET_REPORT.run` `effect.fill`. Caveat: the date is taken in UTC, so before 05:30 IST it
   lands on the previous day. The proper fix is a kernel ticket for a `today` value in the business time zone.
4. Give the re-run its own action (`MARKET_REPORT.rerun`, `effect: { patch: reports … }`), or make it a kernel ticket for
   `applyEffect` to answer ok:false when the insert wrote no row.
