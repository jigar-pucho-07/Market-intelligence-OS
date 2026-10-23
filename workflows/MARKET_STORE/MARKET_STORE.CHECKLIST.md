# Studio checklist — MARKET_STORE

File: `MARKET_STORE.json`. Do the steps in order. Tick each box.

## 1. Import
- [ ] Studio → Flows → Import → pick the file above.

## 2. GET reports (today's row, the re-run target) (`step_read_reports`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Accept": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `*`
  - **authType**: `NONE`

## 3. POST /api/jobs/<id> failed (`step_refuse_job`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/jobs/{{step_refuse_job_loop['item']['id']}}`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"status": "{{step_refuse_job_loop['item']['status']}}", "result": "{{step_refuse_job_loop['item']['result']}}"}}`

## 4. POST reports — today's report (Report_ID numbered by the app; 409 = today's exists) (`step_new_insert`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Report_Date": "{{step_plan['row']['Report_Date']}}", "Created_At": "{{step_plan['row']['Created_At']}}", "Trigger": "{{step_plan['row']['Trigger']}}", "Status": "{{step_plan['row']['Status']}}", "Sentiment": "{{step_plan['row']['Sentiment']}}", "Confidence_Level": "{{step_plan['row']['Confidence_Level']}}", "Confidence_Pct": "{{step_plan['row']['Confidence_Pct']}}", "Driver_1": "{{step_plan['row']['Driver_1']}}", "Driver_2": "{{step_plan['row']['Driver_2']}}", "Driver_3": "{{step_plan['row']['Driver_3']}}", "Sensex_Outlook": "{{step_plan['row']['Sensex_Outlook']}}", "Sensex_Range": "{{step_plan['row']['Sensex_Range']}}", "Sensex_Reason": "{{step_plan['row']['Sensex_Reason']}}", "Nifty_Outlook": "{{step_plan['row']['Nifty_Outlook']}}", "Nifty_Range": "{{step_plan['row']['Nifty_Range']}}", "Nifty_Reason": "{{step_plan['row']['Nifty_Reason']}}", "BankNifty_Outlook": "{{step_plan['row']['BankNifty_Outlook']}}", "BankNifty_Range": "{{step_plan['row']['BankNifty_Range']}}", "BankNifty_Reason": "{{step_plan['row']['BankNifty_Reason']}}", "FnO_View": "{{step_plan['row']['FnO_View']}}", "VIX_Expectation": "{{step_plan['row']['VIX_Expectation']}}", "FnO_Reason": "{{step_plan['row']['FnO_Reason']}}", "MidSmall_Outlook": "{{step_plan['row']['MidSmall_Outlook']}}", "MidSmall_Focus": "{{step_plan['row']['MidSmall_Focus']}}", "MidSmall_Reason": "{{step_plan['row']['MidSmall_Reason']}}", "Commodity_Outlook": "{{step_plan['row']['Commodity_Outlook']}}", "Commodity_Reason": "{{step_plan['row']['Commodity_Reason']}}", "Sectors": "{{step_plan['row']['Sectors']}}", "Risks": "{{step_plan['row']['Risks']}}", "View_Positional": "{{step_plan['row']['View_Positional']}}", "View_Intraday": "{{step_plan['row']['View_Intraday']}}", "View_LongTerm": "{{step_plan['row']['View_LongTerm']}}", "View_FnO": "{{step_plan['row']['View_FnO']}}", "Articles_Analyzed": "{{step_plan['row']['Articles_Analyzed']}}", "Category_Breakdown": "{{step_plan['row']['Category_Breakdown']}}", "Source_Status": "{{step_plan['row']['Source_Status']}}", "Model": "{{step_plan['row']['Model']}}", "WhatsApp_Message": "{{step_plan['row']['WhatsApp_Message']}}", "Message_Length": "{{step_plan['row']['Message_Length']}}", "Error_Message": "{{step_plan['row']['Error_Message']}}", "Report_ID": ""}}`

## 5. POST news_articles (ids: Report_ID + dedupe key — a re-run never doubles them) (`step_new_news`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/data/news_articles`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{{step_new_after['news']}}`

## 6. POST BROADCAST {action: send | alert} (`step_new_bc`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['broadcast_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "{{step_new_bc_loop['item']['action']}}", "Report_ID": "{{step_new_bc_loop['item']['Report_ID']}}", "_who": "flow:MARKET_STORE"}}`

## 7. POST /api/jobs/<id> done | failed (`step_new_job`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/jobs/{{step_new_job_loop['item']['id']}}`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"status": "{{step_new_job_loop['item']['status']}}", "result": "{{step_new_job_loop['item']['result']}}"}}`

## 8. PATCH reports — re-run a Failed report (Failed → Ready, or Failed with the new error) (`step_rerun_update`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `PATCH`
  - **url**: `{{step_constants['app_url']}}/api/data/reports`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **queryParams**: `eq.{{step_plan['Report_ID']}}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"Report_Date": "{{step_plan['row']['Report_Date']}}", "Trigger": "{{step_plan['row']['Trigger']}}", "Status": "{{step_plan['row']['Status']}}", "Sentiment": "{{step_plan['row']['Sentiment']}}", "Confidence_Level": "{{step_plan['row']['Confidence_Level']}}", "Confidence_Pct": "{{step_plan['row']['Confidence_Pct']}}", "Driver_1": "{{step_plan['row']['Driver_1']}}", "Driver_2": "{{step_plan['row']['Driver_2']}}", "Driver_3": "{{step_plan['row']['Driver_3']}}", "Sensex_Outlook": "{{step_plan['row']['Sensex_Outlook']}}", "Sensex_Range": "{{step_plan['row']['Sensex_Range']}}", "Sensex_Reason": "{{step_plan['row']['Sensex_Reason']}}", "Nifty_Outlook": "{{step_plan['row']['Nifty_Outlook']}}", "Nifty_Range": "{{step_plan['row']['Nifty_Range']}}", "Nifty_Reason": "{{step_plan['row']['Nifty_Reason']}}", "BankNifty_Outlook": "{{step_plan['row']['BankNifty_Outlook']}}", "BankNifty_Range": "{{step_plan['row']['BankNifty_Range']}}", "BankNifty_Reason": "{{step_plan['row']['BankNifty_Reason']}}", "FnO_View": "{{step_plan['row']['FnO_View']}}", "VIX_Expectation": "{{step_plan['row']['VIX_Expectation']}}", "FnO_Reason": "{{step_plan['row']['FnO_Reason']}}", "MidSmall_Outlook": "{{step_plan['row']['MidSmall_Outlook']}}", "MidSmall_Focus": "{{step_plan['row']['MidSmall_Focus']}}", "MidSmall_Reason": "{{step_plan['row']['MidSmall_Reason']}}", "Commodity_Outlook": "{{step_plan['row']['Commodity_Outlook']}}", "Commodity_Reason": "{{step_plan['row']['Commodity_Reason']}}", "Sectors": "{{step_plan['row']['Sectors']}}", "Risks": "{{step_plan['row']['Risks']}}", "View_Positional": "{{step_plan['row']['View_Positional']}}", "View_Intraday": "{{step_plan['row']['View_Intraday']}}", "View_LongTerm": "{{step_plan['row']['View_LongTerm']}}", "View_FnO": "{{step_plan['row']['View_FnO']}}", "Articles_Analyzed": "{{step_plan['row']['Articles_Analyzed']}}", "Category_Breakdown": "{{step_plan['row']['Category_Breakdown']}}", "Source_Status": "{{step_plan['row']['Source_Status']}}", "Model": "{{step_plan['row']['Model']}}", "WhatsApp_Message": "{{step_plan['row']['WhatsApp_Message']}}", "Message_Length": "{{step_plan['row']['Message_Length']}}", "Error_Message": "{{step_plan['row']['Error_Message']}}"}}`

## 9. POST news_articles (ids: Report_ID + dedupe key — a re-run never doubles them) (`step_rerun_news`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/data/news_articles`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{{step_rerun_after['news']}}`

## 10. POST BROADCAST {action: send | alert} (`step_rerun_bc`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['broadcast_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "{{step_rerun_bc_loop['item']['action']}}", "Report_ID": "{{step_rerun_bc_loop['item']['Report_ID']}}", "_who": "flow:MARKET_STORE"}}`

## 11. POST /api/jobs/<id> done | failed (`step_rerun_job`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['app_url']}}/api/jobs/{{step_rerun_job_loop['item']['id']}}`
  - **headers**: `{"Content-Type": "application/json", "Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"status": "{{step_rerun_job_loop['item']['status']}}", "result": "{{step_rerun_job_loop['item']['result']}}"}}`

## 12. Constants + action check (first step) (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_APP_URL` → the app's public origin, e.g. `https://<client>-os.pucho.app` (no trailing slash)
  - `SET_IN_STUDIO_BROADCAST_WEBHOOK_URL` → the real value
  - `SET_IN_STUDIO_INBOUND_TOKEN` → this flow's own token: set `INBOUND_TOKEN_<FLOW>` in the app's environment and paste the same value here (one token per flow — a leak points at one flow and one flow can be cut off); the shared `INBOUND_TOKEN` also works (docs/security.md § Inbound tokens)

## 13. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Read the write: Report_ID · news ids · hand-offs (CODE)**. Its code has **50 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.
## 14. Test the trigger — one payload per action
- [ ] Open the trigger step → **Test** → paste a payload below → send. Studio then shows every later step's input filled in, and `{{trigger['body'][…]}}` picks resolve in the UI.
- [ ] After the test, open each **http** step: the **JSON Body** box lists the fields it writes (named, one per column). If a box is empty, the import did not take `body.data` — tell Claude.
- [ ] Test one update with an optional field left blank (e.g. no Close_Reason): the row's column must stay as it was. If it was blanked, tell Claude (the app would then need a skip-empty rule).
- [ ] Each test must end at a **Return** step with `ok: true` and the row it wrote; a run that stops earlier is a failed path.
- [ ] A WhatsApp **text** send reaches a number only inside Meta's 24-hour window after the customer last wrote; a reminder or a win-back must be a **template** send (`sends.template`) approved on whatsapp.pucho.ai.

**store — sent by MARKET_ANALYSE (shape only; test MARKET_REPORT instead)**
```json
{
  "action": "store",
  "Mode": "run",
  "Trigger": "Manual",
  "Report_ID": "",
  "_job": "",
  "report": {
    "Report_Date": "2026-10-15",
    "Status": "Failed",
    "Error_Message": "Studio test — no analysis",
    "Source_Status": "test"
  },
  "articles": []
}
```

From a terminal (the app sends the same): `curl -X POST <webhook URL>/sync -H 'Content-Type: application/json' -d @payload.json`


## 15. Hand back
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
