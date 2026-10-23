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

## 4. Constants — holidays (NSE trading holidays, ⚑ G3: the SAME list in DAILY_SCHEDULE and DAILY_WATCHDOG) and MARKET_REPORT's URL (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_MARKET_REPORT_WEBHOOK_URL` → the real value

## 5. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Weekday and not an NSE holiday? (CODE)**. Its code has **21 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.

## 6. Hand back
- [ ] Copy the webhook URL from the trigger step and send it to Claude.
- Claude adds `/sync` at the end when the app waits for the flow's answer. Do not add it yourself.

## Wiring the seven Market Intelligence flows (all of them — do this once)
- Import in this order, publishing each and copying its webhook URL: MARKET_PUBLISH → BROADCAST → MARKET_STORE → MARKET_ANALYSE → MARKET_REPORT → DAILY_WATCHDOG → DAILY_SCHEDULE.
- **No webhook secret (owner decision 23 Oct 2026).** The flows no longer check a `?k=` secret: anyone who knows a webhook URL can start that flow
  (SA-01..SA-04 reopened). Keep the URLs private; only the action is checked (400 for an unknown one).
- Paste each URL **bare** (never `/sync` — every flow-to-flow hop is async) into the `<flow>_webhook` constant that names it.
- The app calls two of them: `WEBHOOK_MARKET_REPORT=<MARKET_REPORT url>` (run, rerun are async) and
  `WEBHOOK_BROADCAST=<BROADCAST url>/sync` (retry waits for its Return; send is async, so the app posts and does not wait).
  UNVERIFIED: that a long send started through /sync keeps running after Studio's sync window closes — if not, split send onto its own bare-URL flow.
- `holidays` (NSE trading holidays, ⚑ G3): fill the SAME list in DAILY_SCHEDULE and DAILY_WATCHDOG.
- **BROADCAST sends by Gmail (owner decision 23 Oct 2026).** Select the Gmail connection on both Gmail steps (send and retry), set `alert_to`
  to the admins' email addresses (comma separated) and, if you like, `sender_name`. Subscribers receive the report at the `Email` on their record.
- Give each flow its own token: `INBOUND_TOKEN_<FLOW>` on the app, the same value in that flow's `inbound_token`. While the app's token is unset every read answers 403 and the flows say APP_CLOSED.
- UNVERIFIED until the first import: LOOP_ON_ITEMS (also nested), `body.data` in the JSON Body box,
  Gmail send_email's response (the message id) and its props on the current piece version (registry props are from v2.0.1),
  `return_response` at the end of a schedule-triggered flow, and the app honouring `?Attempts=eq.<n>` on PATCH (kernel ticket: today the door filters on the id only).
