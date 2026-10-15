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

## 4. POST deliveries — Queued (409 = already sent → skip) (`step_send_queue`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Kind": "{{step_send_loop['item']['delivery']['Kind']}}", "Report_ID": "{{step_send_loop['item']['delivery']['Report_ID']}}", "Report_Date": "{{step_send_loop['item']['delivery']['Report_Date']}}", "Subscriber_ID": "{{step_send_loop['item']['delivery']['Subscriber_ID']}}", "Subscriber_Name": "{{step_send_loop['item']['delivery']['Subscriber_Name']}}", "Sentiment": "{{step_send_loop['item']['delivery']['Sentiment']}}", "Status": "{{step_send_loop['item']['delivery']['Status']}}", "Delivery_ID": ""}}`

## 5. Send WhatsApp template (mi_daily_report · mi_run_failed) (`step_send_whatsapp`, pucho-whatsapp)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **account_id**: `{{step_constants['whatsapp_account_id']}}`
  - **to**: `{{step_send_gate['to']}}`
  - **template_id**: `{{step_send_gate['template_id']}}`
  - **template_variables**: `{{step_send_gate['template_variables']}}`

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

## 7. POST MARKET_PUBLISH — counts, reader copy, Last_Delivered_At, job (`step_send_publish`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['publish_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "publish", "Report_ID": "{{step_send_plan['publish']['Report_ID']}}", "Since": "{{step_send_plan['publish']['Since']}}", "_job": "{{step_send_plan['publish']['_job']}}", "_who": "flow:BROADCAST"}}`

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

## 11. Send WhatsApp template mi_daily_report to the number on the subscriber record (`step_retry_whatsapp`, pucho-whatsapp)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **account_id**: `{{step_constants['whatsapp_account_id']}}`
  - **to**: `{{step_retry_loop['item']['to']}}`
  - **template_id**: `{{step_retry_loop['item']['template_id']}}`
  - **template_variables**: `{{step_retry_loop['item']['template_variables']}}`

## 12. PATCH the same delivery Sent or Failed (`step_retry_update`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `eq.{{step_retry_result['Delivery_ID']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Status": "{{step_retry_result['Status']}}", "Message_ID": "{{step_retry_result['Message_ID']}}", "Error_Message": "{{step_retry_result['Error_Message']}}", "Sent_At": "{{step_retry_result['Sent_At']}}"}}`

## 13. POST MARKET_PUBLISH — refresh the report's counts (`step_retry_publish`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['publish_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "publish", "Report_ID": "{{step_retry_plan['publish']['Report_ID']}}", "Since": "{{step_retry_plan['publish']['Since']}}", "_job": "", "_who": "flow:BROADCAST"}}`

## 14. Constants — app_url, inbound_token and the flow's settings (set in Studio) (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_ADMIN_WHATSAPP_NUMBERS` → the real value
  - `SET_IN_STUDIO_APP_URL` → the app's public origin, e.g. `https://<client>-os.pucho.app` (no trailing slash)
  - `SET_IN_STUDIO_INBOUND_TOKEN` → this flow's own token: set `INBOUND_TOKEN_<FLOW>` in the app's environment and paste the same value here (one token per flow — a leak points at one flow and one flow can be cut off); the shared `INBOUND_TOKEN` also works (docs/security.md § Inbound tokens)
  - `SET_IN_STUDIO_MARKET_PUBLISH_WEBHOOK_URL` → the real value
  - `SET_IN_STUDIO_TEMPLATE_ID_MI_DAILY_REPORT` → the approved template's id: open the **Send Template Message** step, pick the template in the **Template** dropdown (the name is in `whatsapp_template_names`), copy the value and paste it here. The template must be approved on whatsapp.pucho.ai first; its {{1}}, {{2}}… must match the variables the step fills
  - `SET_IN_STUDIO_TEMPLATE_ID_MI_RUN_FAILED` → the approved template's id: open the **Send Template Message** step, pick the template in the **Template** dropdown (the name is in `whatsapp_template_names`), copy the value and paste it here. The template must be approved on whatsapp.pucho.ai first; its {{1}}, {{2}}… must match the variables the step fills
  - `SET_IN_STUDIO_WHATSAPP_ACCOUNT_ID` → the client's WhatsApp account on Pucho WhatsApp: open any pucho-whatsapp step, pick the account in its **WhatsApp Account** dropdown, copy the value (the account's id) and paste it here — every send step reads it from this constant

## 15. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Sent or Failed? (CODE)**. Its code has **19 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.
## 16. Test the trigger — one payload per action
- [ ] Open the trigger step → **Test** → paste a payload below → send. Studio then shows every later step's input filled in, and `{{trigger['body'][…]}}` picks resolve in the UI.
- [ ] After the test, open each **http** step: the **JSON Body** box lists the fields it writes (named, one per column). If a box is empty, the import did not take `body.data` — tell Claude.
- [ ] Test one update with an optional field left blank (e.g. no Close_Reason): the row's column must stay as it was. If it was blanked, tell Claude (the app would then need a skip-empty rule).
- [ ] Each test must end at a **Return** step with `ok: true` and the row it wrote; a run that stops earlier is a failed path.
- [ ] A WhatsApp **text** send reaches a number only inside Meta's 24-hour window after the customer last wrote; a reminder or a win-back must be a **template** send (`sends.template`) approved on whatsapp.pucho.ai.

**send — a Ready report to every Active, opted-in subscriber**
```json
{
  "action": "send",
  "Report_ID": "MIR-2026-0101"
}
```

**send — admin alert (what the watchdog sends)**
```json
{
  "action": "send",
  "Kind": "Alert",
  "Report_ID": "",
  "Error_Message": "Studio test alert"
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


## 17. Hand back
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
