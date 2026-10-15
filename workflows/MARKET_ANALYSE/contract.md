# MARKET_ANALYSE
trigger: `webhook.catch_webhook` {}
constants: `{"news_limit": 40, "summary_chars": 300, "dedupe_chars": 60, "max_age_hours": 48, "webhook_secret": "SET_IN_STUDIO_WEBHOOK_SECRET"}`
writes: reports, audit_log

Shape: trigger → `step_constants` → [`step_router` on action →] `step_<action>_ai` → `step_<action>_build` (parse + row, CODE) → `step_<action>_insert|update` (http → the app's /api/data, named fields under body.data) → `step_<action>_done` (Return: ok, id, row).
Built by `scripts/build_flows.py` (flow/flowkit.py); the JSON lands beside this file as `MARKET_ANALYSE.json`; the CHECKLIST carries a test payload per action.

### `run`  (model: none, ~45s, ~19 credits, 22 runs/month)
payload: `{"Trigger": "string", "Report_ID": "string"}`
result: `{"Status": "string", "Articles_Analyzed": "number"}`
rules: Called only by MARKET_REPORT (?k= secret checked first, 401 otherwise). Five RSS GETs (feeds.* constants, Google News per publisher) → parse / dedupe / categorise / impact → no news → Failed row; else ONE llm-ai call (model class standard) → parse + advice check → POST MARKET_STORE ?k=

### `rerun`  (model: none, ~45s, ~19 credits, 8 runs/month)
payload: `{"Report_ID": "string"}`
result: `{"Status": "string", "Articles_Analyzed": "number"}`
rules: As run, for today's Failed report
