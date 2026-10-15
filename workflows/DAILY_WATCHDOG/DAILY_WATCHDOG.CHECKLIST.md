# Studio checklist — DAILY_WATCHDOG

File: `DAILY_WATCHDOG.json`. Do the steps in order. Tick each box.

## 1. Import
- [ ] Studio → Flows → Import → pick the file above.

## 2. Trigger — Mon–Fri at 06:20 IST — the watchdog
- [ ] Pick the connection for **schedule**.

## 3. GET reports (the app's door) (`step_read_reports`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 4. POST BROADCAST {action: send, Kind: Alert} (`step_alert_post`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['broadcast_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "send", "Kind": "Alert", "Report_ID": "", "Error_Message": "{{step_check['Error_Message']}}", "_who": "flow:DAILY_WATCHDOG"}}`

## 5. Constants — app_url, inbound_token and the flow's settings (set in Studio) (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_APP_URL` → the app's public origin, e.g. `https://<client>-os.pucho.app` (no trailing slash)
  - `SET_IN_STUDIO_BROADCAST_WEBHOOK_URL` → the real value
  - `SET_IN_STUDIO_INBOUND_TOKEN` → this flow's own token: set `INBOUND_TOKEN_<FLOW>` in the app's environment and paste the same value here (one token per flow — a leak points at one flow and one flow can be cut off); the shared `INBOUND_TOKEN` also works (docs/security.md § Inbound tokens)

## 6. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Today's report row there? (CODE)**. Its code has **40 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.

## 7. Hand back
- [ ] Copy the webhook URL from the trigger step and send it to Claude.
- Claude adds `/sync` at the end when the app waits for the flow's answer. Do not add it yourself.

## Wiring the six Market Intelligence flows (all of them — do this once)
- Import in this order, publishing each and copying its webhook URL: MARKET_PUBLISH → BROADCAST → MARKET_STORE → MARKET_REPORT → DAILY_WATCHDOG → DAILY_SCHEDULE.
- Paste each URL **bare** (never `/sync` — every hop is async) into the constant that names it: `publish_webhook` (BROADCAST),
  `broadcast_webhook` (MARKET_STORE, DAILY_WATCHDOG), `market_store_webhook` (MARKET_REPORT), `market_report_webhook` (DAILY_SCHEDULE).
- The app calls only two of them: `WEBHOOK_MARKET_REPORT` = the bare URL (run and rerun are async), and `WEBHOOK_BROADCAST` = `<url>/sync`
  (one variable serves both actions: retry is sync and waits for its Return; send is async, so the app posts and does not wait). UNVERIFIED: that a
  long send started through /sync keeps running after Studio's sync window closes — if not, split send onto its own bare-URL flow.
- Give each flow its own token: `INBOUND_TOKEN_<FLOW>` on the app, the same value in that flow's `inbound_token`. While the app's token is unset every read answers 403 and the flows say APP_CLOSED.
- UNVERIFIED until the first import: LOOP_ON_ITEMS shape, `body.data` in the JSON Body box, pucho-whatsapp's response and `template_variables` keys
  (mi_daily_report: date, sentiment, confidence, driver · mi_run_failed: error, date, time), `return_response` at the end of a schedule-triggered flow.
