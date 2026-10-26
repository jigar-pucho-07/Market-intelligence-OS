# MARKET_STORE
trigger: `webhook.catch_webhook` {}
constants: `{"auto_send": true}`
writes: reports, news_articles, audit_log

Shape: trigger → `step_constants` → [`step_router` on action →] `step_<action>_ai` → `step_<action>_build` (parse + row, CODE) → `step_<action>_insert|update` (http → the app's /api/data, named fields under body.data) → `step_<action>_done` (Return: ok, id, row).
Built by `scripts/build_flows.py` (flow/flowkit.py); the JSON lands beside this file as `MARKET_STORE.json`; the CHECKLIST carries a test payload per action.

### `store`  (model: none, ~5s, ~12 credits, 30 runs/month)
payload: `{"Mode": "string", "Trigger": "string", "Report_ID": "string"}`
result: `{"Report_ID": "string", "Status": "string"}`
rules: Called only by MARKET_REPORT with the finished report and articles. run: no row today → POST; today's row Failed → PATCH it; Ready / Sent → refused for the schedule, PATCHed for a manual run. rerun: today's report, any Status; a failed re-run never replaces a Ready / Sent one (RERUN_FAILED). Then news_articles (NWS-<Report_ID>-<hash>), BROADCAST (Failed → Kind Alert; Ready → only on a scheduled run with auto_send), POST /api/jobs/<_job>
