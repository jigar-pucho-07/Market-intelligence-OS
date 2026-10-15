# Studio checklist — MARKET_PUBLISH

File: `MARKET_PUBLISH.json`. Do the steps in order. Tick each box.

## 1. Import
- [ ] Studio → Flows → Import → pick the file above.

## 2. GET reports (`step_read_reports`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 3. GET deliveries (`step_read_deliveries`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/deliveries`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 4. PATCH the report Sent · Sent_At · Sent_Count · Failed_Count (`step_report_update`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `eq.{{step_pub_loop['item']['Report_ID']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Status": "{{step_pub_loop['item']['patch']['Status']}}", "Sent_At": "{{step_pub_loop['item']['patch']['Sent_At']}}", "Sent_Count": "{{step_pub_loop['item']['patch']['Sent_Count']}}", "Failed_Count": "{{step_pub_loop['item']['patch']['Failed_Count']}}"}}`

## 5. UPSERT published_reports, 1 of 2: POST (409 = already published) (`step_published_insert`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/data/published_reports`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Report_ID": "{{step_pub_loop['item']['published']['Report_ID']}}", "Published_At": "{{step_pub_loop['item']['published']['Published_At']}}", "Report_Date": "{{step_pub_loop['item']['published']['Report_Date']}}", "Sentiment": "{{step_pub_loop['item']['published']['Sentiment']}}", "Confidence_Level": "{{step_pub_loop['item']['published']['Confidence_Level']}}", "Confidence_Pct": "{{step_pub_loop['item']['published']['Confidence_Pct']}}", "Driver_1": "{{step_pub_loop['item']['published']['Driver_1']}}", "Driver_2": "{{step_pub_loop['item']['published']['Driver_2']}}", "Driver_3": "{{step_pub_loop['item']['published']['Driver_3']}}", "Sensex_Outlook": "{{step_pub_loop['item']['published']['Sensex_Outlook']}}", "Sensex_Range": "{{step_pub_loop['item']['published']['Sensex_Range']}}", "Sensex_Reason": "{{step_pub_loop['item']['published']['Sensex_Reason']}}", "Nifty_Outlook": "{{step_pub_loop['item']['published']['Nifty_Outlook']}}", "Nifty_Range": "{{step_pub_loop['item']['published']['Nifty_Range']}}", "Nifty_Reason": "{{step_pub_loop['item']['published']['Nifty_Reason']}}", "BankNifty_Outlook": "{{step_pub_loop['item']['published']['BankNifty_Outlook']}}", "BankNifty_Range": "{{step_pub_loop['item']['published']['BankNifty_Range']}}", "BankNifty_Reason": "{{step_pub_loop['item']['published']['BankNifty_Reason']}}", "FnO_View": "{{step_pub_loop['item']['published']['FnO_View']}}", "VIX_Expectation": "{{step_pub_loop['item']['published']['VIX_Expectation']}}", "FnO_Reason": "{{step_pub_loop['item']['published']['FnO_Reason']}}", "MidSmall_Outlook": "{{step_pub_loop['item']['published']['MidSmall_Outlook']}}", "MidSmall_Focus": "{{step_pub_loop['item']['published']['MidSmall_Focus']}}", "MidSmall_Reason": "{{step_pub_loop['item']['published']['MidSmall_Reason']}}", "Commodity_Outlook": "{{step_pub_loop['item']['published']['Commodity_Outlook']}}", "Commodity_Reason": "{{step_pub_loop['item']['published']['Commodity_Reason']}}", "Sectors": "{{step_pub_loop['item']['published']['Sectors']}}", "Risks": "{{step_pub_loop['item']['published']['Risks']}}", "View_Positional": "{{step_pub_loop['item']['published']['View_Positional']}}", "View_Intraday": "{{step_pub_loop['item']['published']['View_Intraday']}}", "View_LongTerm": "{{step_pub_loop['item']['published']['View_LongTerm']}}", "View_FnO": "{{step_pub_loop['item']['published']['View_FnO']}}", "Articles_Analyzed": "{{step_pub_loop['item']['published']['Articles_Analyzed']}}", "WhatsApp_Message": "{{step_pub_loop['item']['published']['WhatsApp_Message']}}"}}`

## 6. UPSERT published_reports, 2 of 2: PATCH (the corrected copy after an edit) (`step_published_update`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/published_reports`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `eq.{{step_pub_loop['item']['Report_ID']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Published_At": "{{step_pub_loop['item']['published']['Published_At']}}", "Report_Date": "{{step_pub_loop['item']['published']['Report_Date']}}", "Sentiment": "{{step_pub_loop['item']['published']['Sentiment']}}", "Confidence_Level": "{{step_pub_loop['item']['published']['Confidence_Level']}}", "Confidence_Pct": "{{step_pub_loop['item']['published']['Confidence_Pct']}}", "Driver_1": "{{step_pub_loop['item']['published']['Driver_1']}}", "Driver_2": "{{step_pub_loop['item']['published']['Driver_2']}}", "Driver_3": "{{step_pub_loop['item']['published']['Driver_3']}}", "Sensex_Outlook": "{{step_pub_loop['item']['published']['Sensex_Outlook']}}", "Sensex_Range": "{{step_pub_loop['item']['published']['Sensex_Range']}}", "Sensex_Reason": "{{step_pub_loop['item']['published']['Sensex_Reason']}}", "Nifty_Outlook": "{{step_pub_loop['item']['published']['Nifty_Outlook']}}", "Nifty_Range": "{{step_pub_loop['item']['published']['Nifty_Range']}}", "Nifty_Reason": "{{step_pub_loop['item']['published']['Nifty_Reason']}}", "BankNifty_Outlook": "{{step_pub_loop['item']['published']['BankNifty_Outlook']}}", "BankNifty_Range": "{{step_pub_loop['item']['published']['BankNifty_Range']}}", "BankNifty_Reason": "{{step_pub_loop['item']['published']['BankNifty_Reason']}}", "FnO_View": "{{step_pub_loop['item']['published']['FnO_View']}}", "VIX_Expectation": "{{step_pub_loop['item']['published']['VIX_Expectation']}}", "FnO_Reason": "{{step_pub_loop['item']['published']['FnO_Reason']}}", "MidSmall_Outlook": "{{step_pub_loop['item']['published']['MidSmall_Outlook']}}", "MidSmall_Focus": "{{step_pub_loop['item']['published']['MidSmall_Focus']}}", "MidSmall_Reason": "{{step_pub_loop['item']['published']['MidSmall_Reason']}}", "Commodity_Outlook": "{{step_pub_loop['item']['published']['Commodity_Outlook']}}", "Commodity_Reason": "{{step_pub_loop['item']['published']['Commodity_Reason']}}", "Sectors": "{{step_pub_loop['item']['published']['Sectors']}}", "Risks": "{{step_pub_loop['item']['published']['Risks']}}", "View_Positional": "{{step_pub_loop['item']['published']['View_Positional']}}", "View_Intraday": "{{step_pub_loop['item']['published']['View_Intraday']}}", "View_LongTerm": "{{step_pub_loop['item']['published']['View_LongTerm']}}", "View_FnO": "{{step_pub_loop['item']['published']['View_FnO']}}", "Articles_Analyzed": "{{step_pub_loop['item']['published']['Articles_Analyzed']}}", "WhatsApp_Message": "{{step_pub_loop['item']['published']['WhatsApp_Message']}}"}}`

## 7. PATCH subscriber Last_Delivered_At (`step_subscriber_update`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/subscribers`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `eq.{{step_touch_loop['item']['Subscriber_ID']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Last_Delivered_At": "{{step_touch_loop['item']['Last_Delivered_At']}}"}}`

## 8. POST /api/jobs/<id> done (`step_job`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/jobs/{{step_job_loop['item']['id']}}`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"status": "{{step_job_loop['item']['status']}}", "result": "{{step_job_loop['item']['result']}}"}}`

## 9. Constants — app_url, inbound_token and the flow's settings (set in Studio) (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_APP_URL` → the app's public origin, e.g. `https://<client>-os.pucho.app` (no trailing slash)
  - `SET_IN_STUDIO_INBOUND_TOKEN` → this flow's own token: set `INBOUND_TOKEN_<FLOW>` in the app's environment and paste the same value here (one token per flow — a leak points at one flow and one flow can be cut off); the shared `INBOUND_TOKEN` also works (docs/security.md § Inbound tokens)

## 10. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Counts · reader copy · who received it (CODE)**. Its code has **44 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.
## 11. Test the trigger — one payload per action
- [ ] Open the trigger step → **Test** → paste a payload below → send. Studio then shows every later step's input filled in, and `{{trigger['body'][…]}}` picks resolve in the UI.
- [ ] After the test, open each **http** step: the **JSON Body** box lists the fields it writes (named, one per column). If a box is empty, the import did not take `body.data` — tell Claude.
- [ ] Test one update with an optional field left blank (e.g. no Close_Reason): the row's column must stay as it was. If it was blanked, tell Claude (the app would then need a skip-empty rule).
- [ ] Each test must end at a **Return** step with `ok: true` and the row it wrote; a run that stops earlier is a failed path.
- [ ] A WhatsApp **text** send reaches a number only inside Meta's 24-hour window after the customer last wrote; a reminder or a win-back must be a **template** send (`sends.template`) approved on whatsapp.pucho.ai.

**publish — sent by BROADCAST after a send**
```json
{
  "action": "publish",
  "Report_ID": "MIR-2026-0101",
  "Since": "2026-10-15T00:30:00.000Z",
  "_job": ""
}
```

From a terminal (the app sends the same): `curl -X POST <webhook URL>/sync -H 'Content-Type: application/json' -d @payload.json`


## 12. Hand back
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
