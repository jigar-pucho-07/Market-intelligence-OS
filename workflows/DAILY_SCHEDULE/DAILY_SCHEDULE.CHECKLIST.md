# Studio checklist — DAILY_SCHEDULE

File: `DAILY_SCHEDULE.json`. Do the steps in order. Tick each box.

## 1. Import
- [ ] Studio → Flows → Import → pick the file above.

## 2. Trigger — Every weekday at 06:00 IST (fixes S1)
- [ ] Pick the connection for **schedule**.

## 3. POST MARKET_REPORT {action: run, Trigger: Schedule} — async, not /sync (`step_run_post`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['market_report_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "run", "Trigger": "Schedule", "_who": "flow:DAILY_SCHEDULE"}}`

## 4. Constants — NSE holidays (⚑ G3, owner fills) and MARKET_REPORT's webhook URL (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_MARKET_REPORT_WEBHOOK_URL` → the real value

## 5. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Weekday and not an NSE holiday? (CODE)**. Its code has **21 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.

## 6. Hand back
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
