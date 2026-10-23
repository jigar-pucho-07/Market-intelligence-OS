# Studio checklist — BROADCAST

File: `BROADCAST.json`. Do the steps in order. Tick each box.

## 1. Import
- [ ] Studio → Flows → Import → pick the file above.

## 2. GET reports (`step_send_reports`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 3. GET subscribers (`step_send_subscribers`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/subscribers`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 4. POST deliveries — Queued, Attempts 1 (409 = already sent) (`step_send_queue`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Kind": "{{step_send_loop['item']['delivery']['Kind']}}", "Report_ID": "{{step_send_loop['item']['delivery']['Report_ID']}}", "Report_Date": "{{step_send_loop['item']['delivery']['Report_Date']}}", "Subscriber_ID": "{{step_send_loop['item']['delivery']['Subscriber_ID']}}", "Subscriber_Name": "{{step_send_loop['item']['delivery']['Subscriber_Name']}}", "Sentiment": "{{step_send_loop['item']['delivery']['Sentiment']}}", "Status": "{{step_send_loop['item']['delivery']['Status']}}", "Delivery_ID": "", "Attempts": 1}}`

## 5. Send email (Gmail): the report, or the admin alert (`step_send_email`, gmail)
- [ ] Pick your **gmail** connection.
- [ ] Studio may blank the boxes below when the connection is picked. Check each one; paste the value if empty:
  - **receiver**: `["{{step_send_loop['item']['to']}}"]`
  - **subject**: `{{step_send_loop['item']['subject']}}`
  - **body_type**: `html`
  - **body**: `{{step_send_loop['item']['body']}}`
  - **sender_name**: `{{step_constants['sender_name']}}`
  - **draft**: `false`

## 6. PATCH the delivery Sent (message id) or Failed (error) (`step_send_update`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `eq.{{step_send_result['Delivery_ID']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Status": "{{step_send_result['Status']}}", "Message_ID": "{{step_send_result['Message_ID']}}", "Error_Message": "{{step_send_result['Error_Message']}}", "Sent_At": "{{step_send_result['Sent_At']}}"}}`

## 7. POST MARKET_PUBLISH — counts, reader copy, job (`step_send_publish`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['market_publish_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "publish", "Report_ID": "{{step_send_plan['publish']['Report_ID']}}", "_job": "{{step_send_plan['publish']['_job']}}", "_who": "flow:BROADCAST"}}`

## 8. GET deliveries (`step_retry_deliveries`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 9. GET subscribers (`step_retry_subscribers`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/subscribers`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 10. GET reports (`step_retry_reports`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 11. PATCH Attempts + 1, only where Attempts = the value read (`step_retry_claim`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `{"Delivery_ID": "eq.{{step_retry_claim_loop['item']['Delivery_ID']}}", "Attempts": "{{step_retry_claim_loop['item']['expect']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Attempts": "{{step_retry_claim_loop['item']['Attempts']}}"}}`

## 12. Send the report email again to the address on the subscriber record (`step_retry_email`, gmail)
- [ ] Pick your **gmail** connection.
- [ ] Studio may blank the boxes below when the connection is picked. Check each one; paste the value if empty:
  - **receiver**: `["{{step_retry_plan['send']['to']}}"]`
  - **subject**: `{{step_retry_plan['send']['subject']}}`
  - **body_type**: `html`
  - **body**: `{{step_retry_plan['send']['body']}}`
  - **sender_name**: `{{step_constants['sender_name']}}`
  - **draft**: `false`

## 13. PATCH the same delivery Sent or Failed (`step_retry_update`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `eq.{{step_retry_result['Delivery_ID']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Status": "{{step_retry_result['Status']}}", "Message_ID": "{{step_retry_result['Message_ID']}}", "Error_Message": "{{step_retry_result['Error_Message']}}", "Sent_At": "{{step_retry_result['Sent_At']}}"}}`

## 14. POST MARKET_PUBLISH — refresh the report's counts (`step_retry_publish`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['market_publish_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "publish", "Report_ID": "{{step_retry_plan['publish']['Report_ID']}}", "_job": "", "_who": "flow:BROADCAST"}}`

## 15. Constants + action check (first step) (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_ADMIN_EMAILS` → the real value
  - `SET_IN_STUDIO_APP_URL` → the app's public origin, e.g. `https://<client>-os.pucho.app` (no trailing slash)
  - `SET_IN_STUDIO_INBOUND_TOKEN` → this flow's own token: set `INBOUND_TOKEN_<FLOW>` in the app's environment and paste the same value here (one token per flow — a leak points at one flow and one flow can be cut off); the shared `INBOUND_TOKEN` also works (docs/security.md § Inbound tokens)
  - `SET_IN_STUDIO_MARKET_PUBLISH_WEBHOOK_URL` → the real value

## 16. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Sent or Failed? (CODE)**. Its code has **21 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.
## 17. Test the trigger — one payload per action
- [ ] Open the trigger step → **Test** → paste a payload below → send. Studio then shows every later step's input filled in, and `{{trigger['body'][…]}}` picks resolve in the UI.
- [ ] After the test, open each **http** step: the **JSON Body** box lists the fields it writes (named, one per column). If a box is empty, the import did not take `body.data` — tell Claude.
- [ ] Test one update with an optional field left blank (e.g. no Close_Reason): the row's column must stay as it was. If it was blanked, tell Claude (the app would then need a skip-empty rule).
- [ ] Each test must end at a **Return** step with `ok: true` and the row it wrote; a run that stops earlier is a failed path.
- [ ] A WhatsApp **text** send reaches a number only inside Meta's 24-hour window after the customer last wrote; a reminder or a win-back must be a **template** send (`sends.template`) approved on whatsapp.pucho.ai.

**send — today's Ready report to every Active, opted-in subscriber**
```json
{
  "action": "send",
  "Report_ID": "MIR-2026-0101"
}
```

**alert — the admin alert (flows only: the watchdog, MARKET_STORE for a Failed report)**
```json
{
  "action": "alert",
  "Report_ID": ""
}
```

**retry — one Failed delivery**
```json
{
  "action": "retry",
  "Delivery_ID": "DLV-2026-2402"
}
```

From a terminal (the app sends the same): `curl -X POST <webhook URL>/sync -H 'Content-Type: application/json' -d @payload.json`


## 18. Hand back
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
