# Studio checklist — MARKET_REPORT

File: `MARKET_REPORT.json`. Do the steps in order. Tick each box.

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

## 4. POST MARKET_ANALYSE — the feeds and the model (`step_analyse_post`, http)
- [ ] No connection to pick. Check each box below; paste the value if it is empty or different.
- [ ] A box that is a dropdown takes a `{{…}}` value only after you press its **ƒ** button. Press ƒ, then paste.
  - **method**: `POST`
  - **url**: `{{step_constants['market_analyse_webhook']}}`
  - **headers**: `application/json`
  - **authType**: `NONE`
  - **body_type**: `json`
  - **body**: `{"data": {"action": "{{step_gate['Mode']}}", "Trigger": "{{step_gate['Trigger']}}", "Report_ID": "{{step_gate['Report_ID']}}", "_job": "{{step_gate['_job']}}", "_who": "flow:MARKET_REPORT"}}`

## 5. Constants + action check (first step) (`step_constants`, code)
- [ ] Open the step's code and replace each placeholder with the real value, then save:
  - `SET_IN_STUDIO_APP_URL` → the app's public origin, e.g. `https://<client>-os.pucho.app` (no trailing slash)
  - `SET_IN_STUDIO_INBOUND_TOKEN` → this flow's own token: set `INBOUND_TOKEN_<FLOW>` in the app's environment and paste the same value here (one token per flow — a leak points at one flow and one flow can be cut off); the shared `INBOUND_TOKEN` also works (docs/security.md § Inbound tokens)
  - `SET_IN_STUDIO_MARKET_ANALYSE_WEBHOOK_URL` → the real value

## 6. Publish
- [ ] Press **Publish**. Edits do nothing until Studio says the flow is published.
- [ ] Self-check: open **Run / re-run allowed today? (CODE)**. Its code has **64 lines** and line 1 is `// @ts-nocheck`. If not, paste it again and publish.
## 7. Test the trigger — one payload per action
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

**rerun — today's Failed report**
```json
{
  "action": "rerun",
  "Report_ID": "MIR-2026-0099",
  "_who": "Test"
}
```

From a terminal (the app sends the same): `curl -X POST <webhook URL>/sync -H 'Content-Type: application/json' -d @payload.json`


## 8. Hand back
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
- **BROADCAST checks every address with ZeroBounce first (owner decision 24 Oct 2026).** Select your ZeroBounce connection (its API key)
  on both "Validate the email address" steps (send and retry). valid or catch-all → the email goes; anything else (invalid, spamtrap,
  abuse, do_not_mail, unknown, or ZeroBounce not answering — e.g. out of credits) → no email, the delivery is Failed with
  "Email not sent — ZeroBounce: <status> <sub_status>". A retry of such a delivery is checked again; if the address is still bad
  the retry answers "Not sent: the email address failed the ZeroBounce check …". Each check uses one ZeroBounce credit.
- Give each flow its own token: `INBOUND_TOKEN_<FLOW>` on the app, the same value in that flow's `inbound_token`. While the app's token is unset every read answers 403 and the flows say APP_CLOSED.
- UNVERIFIED until the first import: LOOP_ON_ITEMS (also nested), `body.data` in the JSON Body box,
  ZeroBounce validateEmail's input name (`email`) and its answer (`status`, `sub_status`) on the current piece version,
  Gmail send_email's response (the message id) and its props on the current piece version (registry props are from v2.0.1),
  `return_response` at the end of a schedule-triggered flow, and the app honouring `?Attempts=eq.<n>` on PATCH (kernel ticket: today the door filters on the id only).
