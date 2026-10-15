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

## 4. POST BROADCAST {action: alert} ?k= (BROADCAST writes the fixed watchdog text) (`step_alert_post`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['broadcast_webhook']}}`
  - **headers**: `application/json`
  - **queryParams**: `{{step_constants['broadcast_secret']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "alert", "Report_ID": "", "_who": "flow:DAILY_WATCHDOG"}}`

## 5. Constants — holidays (NSE trading holidays, ⚑ G3: the SAME list in DAILY_SCHEDULE and DAILY_WATCHDOG), app_url, inbound_token and BROADCAST's URL + secret (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_APP_URL` → the app's public origin, e.g. `https://<client>-os.pucho.app` (no trailing slash)
  - `SET_IN_STUDIO_BROADCAST_WEBHOOK_SECRET` → the real value
  - `SET_IN_STUDIO_BROADCAST_WEBHOOK_URL` → the real value
  - `SET_IN_STUDIO_INBOUND_TOKEN` → this flow's own token: set `INBOUND_TOKEN_<FLOW>` in the app's environment and paste the same value here (one token per flow — a leak points at one flow and one flow can be cut off); the shared `INBOUND_TOKEN` also works (docs/security.md § Inbound tokens)

## 6. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Today's report row there? (CODE)**. Its code has **30 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.

## 7. Hand back
- [ ] Copy the webhook URL from the trigger step and send it to Claude.
- Claude adds `/sync` at the end when the app waits for the flow's answer. Do not add it yourself.

## Wiring the seven Market Intelligence flows (all of them — do this once)
- Import in this order, publishing each and copying its webhook URL: MARKET_PUBLISH → BROADCAST → MARKET_STORE → MARKET_ANALYSE → MARKET_REPORT → DAILY_WATCHDOG → DAILY_SCHEDULE.
- **Webhook secrets (SA-01..SA-04).** Generate one random secret per webhook flow (≥ 32 characters, e.g. `openssl rand -hex 24`): MARKET_REPORT, MARKET_ANALYSE,
  MARKET_STORE, BROADCAST, MARKET_PUBLISH. Paste each into that flow's own `webhook_secret` constant AND into the `<flow>_secret` constant of every flow that
  calls it. A missing or wrong `?k=` answers 401 before anything is read, fetched, sent or written; a placeholder secret refuses everyone.
- Paste each URL **bare** (never `/sync` — every flow-to-flow hop is async) into the `<flow>_webhook` constant that names it; the `?k=` is added by the step.
- The app calls two of them, with the secret in the URL: `WEBHOOK_MARKET_REPORT=<MARKET_REPORT url>?k=<MARKET_REPORT secret>` (run, rerun are async) and
  `WEBHOOK_BROADCAST=<BROADCAST url>/sync?k=<BROADCAST secret>` (retry waits for its Return; send is async, so the app posts and does not wait).
  UNVERIFIED: that a long send started through /sync keeps running after Studio's sync window closes — if not, split send onto its own bare-URL flow.
- `holidays` (NSE trading holidays, ⚑ G3): fill the SAME list in DAILY_SCHEDULE and DAILY_WATCHDOG.
- Give each flow its own token: `INBOUND_TOKEN_<FLOW>` on the app, the same value in that flow's `inbound_token`. While the app's token is unset every read answers 403 and the flows say APP_CLOSED.
- UNVERIFIED until the first import: `{{trigger['queryParams']['k']}}` (the query string on catch_webhook), LOOP_ON_ITEMS (also nested), `body.data` in the JSON Body box,
  pucho-whatsapp's response and `template_variables` keys (mi_daily_report: date, sentiment, confidence, driver · mi_run_failed: error, date, time),
  `return_response` at the end of a schedule-triggered flow, and the app honouring `?Attempts=eq.<n>` on PATCH (kernel ticket: today the door filters on the id only).
