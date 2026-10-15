# MARKET_PUBLISH
trigger: `webhook.catch_webhook` {}
constants: `{}`
writes: reports, published_reports, audit_log

Shape: trigger → `step_constants` → [`step_router` on action →] `step_<action>_ai` → `step_<action>_build` (parse + row, CODE) → `step_<action>_insert|update` (http → the app's /api/data, named fields under body.data) → `step_<action>_done` (Return: ok, id, row).
Built by `scripts/build_flows.py` (flow/flowkit.py); the JSON lands beside this file as `MARKET_PUBLISH.json`; the CHECKLIST carries a test payload per action.

### `publish`  (model: none, ~6s, ~12 credits, 46 runs/month)
payload: `{"Report_ID": "string", "Since": "string"}`
result: `{"sent": "number", "failed": "number"}`
rules: Called only by BROADCAST (after send and after retry). From the app's rows: report Sent + Sent_At + Sent_Count + Failed_Count; UPSERT published_reports (POST, then PATCH); POST /api/jobs/<_job> done. A Failed or unknown report writes nothing
