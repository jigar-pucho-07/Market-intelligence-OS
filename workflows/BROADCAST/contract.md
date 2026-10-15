# BROADCAST
trigger: `webhook.catch_webhook` {}
constants: `{"report_template": "mi_daily_report", "alert_template": "mi_run_failed", "alert_to": "SET_IN_STUDIO_ADMIN_WHATSAPP_NUMBERS", "portal_url": "SET_IN_STUDIO_APP_URL"}`
writes: reports, published_reports, deliveries, audit_log

Shape: trigger → `step_constants` → [`step_router` on action →] `step_<action>_ai` → `step_<action>_build` (parse + row, CODE) → `step_<action>_insert|update` (http → the app's /api/data, named fields under body.data) → `step_<action>_done` (Return: ok, id, row).
Built by `scripts/build_flows.py` (flow/flowkit.py); the JSON lands beside this file as `BROADCAST.json`; the CHECKLIST carries a test payload per action.

### `send`  (model: none, ~30s, ~258 credits, 26 runs/month)
payload: `{"Report_ID": "string"}`
result: `{"sent": "number", "failed": "number", "skipped": "number"}`
rules: Ready report → for each Active subscriber with Opt_In_At and Opt_In_Source: INSERT a Queued delivery (unique Report_Date + Subscriber_ID + Kind; a 409 means already sent → skip) → pucho-whatsapp approved template mi_daily_report (date, sentiment, confidence, first driver; the portal link is the template's URL button) → PATCH the delivery Sent with the message id, or Failed with the error (CODE + LOOP_ON_ITEMS); Then POST MARKET_PUBLISH: UPSERT published_reports (the reader-safe columns) and PATCH the report Sent, Sent_At, Sent_Count, Failed_Count (owner trim 15 Oct: no per-subscriber write — the delivery log is the record); Failed report → template mi_run_failed (error, date, IST time) to constants.alert_to; a Kind=Alert delivery row; nothing goes to subscribers

### `retry`  (model: none, ~6s, ~13 credits, 20 runs/month)
payload: `{"Delivery_ID": "string"}`
result: `{"sent": "boolean"}`
rules: Reads the delivery and its subscriber; refuses unless the subscriber is Active and opted in, the delivery is a Failed Report and Attempts < 3; increments Attempts; sends the same template to the number on the subscriber record (never a number from the payload); PATCHes the same delivery row Sent or Failed
