# DAILY_WATCHDOG
trigger: `schedule.cron_expression` {}
constants: `{"cron": "20 6 * * 1-5", "timezone": "Asia/Kolkata", "holidays": []}`
writes: reports

Shape: trigger → `step_constants` → [`step_router` on action →] `step_<action>_ai` → `step_<action>_build` (parse + row, CODE) → `step_<action>_insert|update` (http → the app's /api/data, named fields under body.data) → `step_<action>_done` (Return: ok, id, row).
Built by `scripts/build_flows.py` (flow/flowkit.py); the JSON lands beside this file as `DAILY_WATCHDOG.json`; the CHECKLIST carries a test payload per action.

### `check`  (model: none, ~4s, ~5 credits, 22 runs/month)
payload: `{}`
result: `{"alerted": "boolean"}`
rules: 06:20 IST Mon–Fri: GET reports; no row for today (or the app unreadable) → POST BROADCAST {action: send, Kind: Alert, Error_Message} → Return — a crashed run still alerts the admins
