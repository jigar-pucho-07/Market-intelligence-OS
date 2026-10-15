# DAILY_SCHEDULE
trigger: `schedule.every_day` {}
constants: `{"hour_of_the_day": 6, "timezone": "Asia/Kolkata", "run_on_weekends": false, "holidays": []}`
writes: reports

Shape: trigger → `step_constants` → [`step_router` on action →] `step_<action>_ai` → `step_<action>_build` (parse + row, CODE) → `step_<action>_insert|update` (http → the app's /api/data, named fields under body.data) → `step_<action>_done` (Return: ok, id, row).
Built by `scripts/build_flows.py` (flow/flowkit.py); the JSON lands beside this file as `DAILY_SCHEDULE.json`; the CHECKLIST carries a test payload per action.

### `trigger`  (model: none, ~4s, ~5 credits, 22 runs/month)
payload: `{"Trigger": "string"}`
result: `{"queued": "boolean"}`
rules: every_day at 06:00 Asia/Kolkata, weekends off; a date in constants.holidays (NSE trading holidays, ⚑ G3 — the owner fills the list from the NSE circular) skips the run → POST MARKET_REPORT {Trigger: Schedule} without /sync (the run is longer than the 25 s sync window) → Return. Fixes S1 (the source ran at 00:30 IST)
