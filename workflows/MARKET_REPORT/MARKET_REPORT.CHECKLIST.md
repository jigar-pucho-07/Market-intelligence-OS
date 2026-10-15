# Studio checklist — MARKET_REPORT

File: `MARKET_REPORT.json`. Do the steps in order. Tick each box.

## 1. Import
- [ ] Studio → Flows → Import → pick the file above.

## 2. Fetch Economic Times Markets RSS (a failure yields 0 items) (`step_fetch_et`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['feeds']['et']}}`
  - **headers**: `{"Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; MarketIntelligence/1.0)"}`
  - **authType**: `NONE`

## 3. Fetch Moneycontrol RSS (a failure yields 0 items) (`step_fetch_mc`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['feeds']['mc']}}`
  - **headers**: `{"Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; MarketIntelligence/1.0)"}`
  - **authType**: `NONE`

## 4. Fetch Reuters India RSS (a failure yields 0 items) (`step_fetch_reuters`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['feeds']['reuters']}}`
  - **headers**: `{"Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; MarketIntelligence/1.0)"}`
  - **authType**: `NONE`

## 5. Fetch Google Finance News RSS (a failure yields 0 items) (`step_fetch_gfn`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['feeds']['gfn']}}`
  - **headers**: `{"Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; MarketIntelligence/1.0)"}`
  - **authType**: `NONE`

## 6. Fetch Global Market Cues RSS (a failure yields 0 items) (`step_fetch_global`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `GET`
  - **url**: `{{step_constants['feeds']['global']}}`
  - **headers**: `{"Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; MarketIntelligence/1.0)"}`
  - **authType**: `NONE`

## 7. POST MARKET_STORE — Failed (no news) (`step_nonews_store`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['market_store_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "store", "Mode": "{{step_prep['Mode']}}", "Trigger": "{{step_prep['Trigger']}}", "Report_ID": "{{step_prep['Report_ID']}}", "_job": "{{step_prep['_job']}}", "_who": "flow:MARKET_REPORT", "report": "{{step_prep['failed_report']}}", "articles": "{{step_prep['articles']}}"}}`

## 8. Ask LLM — the pre-market commentary as JSON (standard, 0.3, 2,000 tokens) (`step_run_ai`, llm-ai)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **model**: `{"modelValue": "openai/gpt-4o-mini", "providerName": "OpenRouter"}`
  - **puchoModelKey**: `openai/gpt-4o-mini`
  - **puchoProviderName**: `OpenRouter`
  - **query**: `{{step_prep['prompt']}}`
  - **temperature**: `0.3`
  - **maxTokens**: `2000`

## 9. POST MARKET_STORE — run (`step_run_store`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['market_store_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "store", "Mode": "{{step_prep['Mode']}}", "Trigger": "{{step_prep['Trigger']}}", "Report_ID": "{{step_prep['Report_ID']}}", "_job": "{{step_prep['_job']}}", "_who": "flow:MARKET_REPORT", "report": "{{step_run_finish['report']}}", "articles": "{{step_prep['articles']}}"}}`

## 10. Ask LLM — the pre-market commentary as JSON (standard, 0.3, 2,000 tokens) (`step_rerun_ai`, llm-ai)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **model**: `{"modelValue": "openai/gpt-4o-mini", "providerName": "OpenRouter"}`
  - **puchoModelKey**: `openai/gpt-4o-mini`
  - **puchoProviderName**: `OpenRouter`
  - **query**: `{{step_prep['prompt']}}`
  - **temperature**: `0.3`
  - **maxTokens**: `2000`

## 11. POST MARKET_STORE — rerun (`step_rerun_store`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['market_store_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "store", "Mode": "{{step_prep['Mode']}}", "Trigger": "{{step_prep['Trigger']}}", "Report_ID": "{{step_prep['Report_ID']}}", "_job": "{{step_prep['_job']}}", "_who": "flow:MARKET_REPORT", "report": "{{step_rerun_finish['report']}}", "articles": "{{step_prep['articles']}}"}}`

## 12. Constants — the five feed URLs, the limits and MARKET_STORE's webhook URL (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_MARKET_STORE_WEBHOOK_URL` → the real value

## 13. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Parse + check the model JSON · format WhatsApp (CODE)**. Its code has **135 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.
## 14. Test the trigger — one payload per action
- [ ] Open the trigger step → **Test** → paste a payload below → send. Studio then shows every later step's input filled in, and `{{trigger['body'][…]}}` picks resolve in the UI.
- [ ] After the test, open each **http** step: the **JSON Body** box lists the fields it writes (named, one per column). If a box is empty, the import did not take `body.data` — tell Claude.
- [ ] Test one update with an optional field left blank (e.g. no Close_Reason): the row's column must stay as it was. If it was blanked, tell Claude (the app would then need a skip-empty rule).
- [ ] Each test must end at a **Return** step with `ok: true` and the row it wrote; a run that stops earlier is a failed path.
- [ ] A WhatsApp **text** send reaches a number only inside Meta's 24-hour window after the customer last wrote; a reminder or a win-back must be a **template** send (`sends.template`) approved on whatsapp.pucho.ai.

**run — today's report (Run report now, DAILY_SCHEDULE)**
```json
{
  "action": "run",
  "Trigger": "Manual",
  "_who": "Test"
}
```

**rerun — a Failed report of today**
```json
{
  "action": "rerun",
  "Report_ID": "MIR-2026-0099",
  "_who": "Test"
}
```

From a terminal (the app sends the same): `curl -X POST <webhook URL>/sync -H 'Content-Type: application/json' -d @payload.json`


## 15. Hand back
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
