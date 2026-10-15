# Workflow complexity

Budget per action path: ≤ 14 steps · ≤ 1 AI call (2 with a code check between) · no nested router · no CODE node > 40 lines · no two CODE nodes in a row. Per flow: ≤ 12 actions.

## BROADCAST — 3 action(s), longest path 9 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| send | 9 | 0 | 1 | — |
| retry | 9 | 0 | 1 | — |
| Unknown action | 4 | 0 | 1 | — |

## DAILY_SCHEDULE — 2 action(s), longest path 6 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| Holiday or weekend — no run | 5 | 0 | 1 | — |
| Run the report | 6 | 0 | 1 | — |

## DAILY_WATCHDOG — 2 action(s), longest path 7 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| No report row — alert the admins | 7 | 0 | 1 | — |
| Report row present | 6 | 0 | 1 | — |

## MARKET_PUBLISH — 0 action(s), longest path 9 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| (single path) | 9 | 0 | 0 | — |

## MARKET_REPORT — 4 action(s), longest path 13 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| No news → Failed row | 11 | 0 | 1 | — |
| Run (today's report) | 13 | 1 | 1 | — |
| Re-run (a Failed report) | 13 | 1 | 1 | — |
| Unknown action | 10 | 0 | 1 | — |

## MARKET_STORE — 4 action(s), longest path 11 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| Refuse (exists / Sent / not Failed / app closed) | 7 | 0 | 1 | — |
| New report (POST) | 11 | 0 | 1 | — |
| Re-run (PATCH) | 11 | 0 | 1 | — |
| Unexpected | 6 | 0 | 1 | — |


## Paths with loop bodies counted (tools/build_market_flows.py)

`flow/complexity.py` follows `nextAction` only, so the tables above do not see inside a loop. Below, each loop body is counted once on
its path (the budget question) and its credits once per item; a router is a step that costs 0, every other executed step 1 credit
(workflow-rules § 1.20 — the llm-ai model charge on top is UNVERIFIED). All counts are Estimated until Studio's billing confirms them.

| flow | path | steps | credits per run |
|---|---|---:|---|
| DAILY_SCHEDULE | Holiday or weekend — no run | 5 | 4 |
| DAILY_SCHEDULE | Run the report | 6 | 5 |
| DAILY_WATCHDOG | No report row — alert the admins | 7 | 6 |
| DAILY_WATCHDOG | Report row present | 6 | 5 |
| MARKET_REPORT | No news → Failed row | 11 | 10 |
| MARKET_REPORT | Run (today's report) | 13 | 12 |
| MARKET_REPORT | Re-run (a Failed report) | 13 | 12 |
| MARKET_REPORT | Unknown action | 10 | 9 |
| MARKET_STORE | Refuse (exists / Sent / not Failed / app closed) | 8 | 6 + step_refuse_job_loop×1 |
| MARKET_STORE | New report (POST) | 13 | 10 + step_new_bc_loop×1 + step_new_job_loop×1 |
| MARKET_STORE | Re-run (PATCH) | 13 | 10 + step_rerun_bc_loop×1 + step_rerun_job_loop×1 |
| MARKET_STORE | Unexpected | 6 | 5 |
| BROADCAST | send | 14 | 8 + step_send_loop×5 |
| BROADCAST | retry › inner Return | 13 | 12 |
| BROADCAST | retry | 14 | 8 + step_retry_loop×5 |
| BROADCAST | Unknown action | 4 | 3 |
| MARKET_PUBLISH | (single path) | 14 | 9 + step_pub_loop×3 + step_touch_loop×1 + step_job_loop×1 |

Longest path with loop bodies counted: **14 steps** (budget 14).

## The three flows the owner adds to os.yaml (the builder made them; os.yaml is the owner's)

Why the split: one Studio flow has one trigger, so the 06:20 watchdog cannot live in DAILY_SCHEDULE; and the old one-flow
MARKET_REPORT (trigger, constants, 5 fetches, parse, router, AI, parse, write report, stamp the news with the app's Report_ID,
write news, BROADCAST, job, Return) is 16–17 steps on its longest path, the old one-flow BROADCAST.send 16 (reads, plan, queue,
send, record, then counts / reader copy / Last_Delivered_At / job). The budget is 14 and a second decision inside a branch
would be a router in a router. So MARKET_REPORT ends by handing the finished row to MARKET_STORE (the writer), and
BROADCAST ends by handing to MARKET_PUBLISH (the bookkeeping after a send). No app page calls the three new flows.

```yaml
  - name: DAILY_WATCHDOG
    covers: [R11]
    trigger: { tool: schedule, name: cron_expression }      # "20 6 * * 1-5", Asia/Kolkata
    constants: { holidays: [] }
    writes: []
    actions:
      - name: check
        model: none
        via: custom
        payload: {}
        result: { alerted: boolean }
        rules: ["06:20 IST Mon–Fri: GET reports; no row for today (or the app unreadable) → POST BROADCAST {action: send, Kind: Alert, Error_Message} → Return"]
        typical_seconds: 4
        credits: 5
        runs_per_month: 22
  - name: MARKET_STORE
    covers: [R10]
    trigger: { tool: webhook, name: catch_webhook, auth: none }
    constants: { auto_send: true }
    writes: [reports, news_articles]
    actions:
      - name: store
        model: none
        via: custom
        payload: { Mode: string, Trigger: string, Report_ID: string, report: object, articles: array }
        result: { Report_ID: string, Status: string }
        rules: ["Called only by MARKET_REPORT. run: no row today → POST; today's row Failed → PATCH it; Ready / Sent → refused. rerun: only a Failed report of today; Sent refused. Then news_articles (NWS-<Report_ID>-<hash>), BROADCAST (Failed → Kind Alert; Ready → only when auto_send), POST /api/jobs/<_job>"]
        typical_seconds: 5
        credits: 12
        runs_per_month: 30
  - name: MARKET_PUBLISH
    covers: [R9, R10]
    trigger: { tool: webhook, name: catch_webhook, auth: none }
    writes: [reports, published_reports, subscribers]
    actions:
      - name: publish
        model: none
        via: custom
        payload: { Report_ID: string, Since: string }
        result: { sent: number, failed: number }
        rules: ["Called only by BROADCAST (after send and after retry). From the app's rows: report Sent + Sent_At + Sent_Count + Failed_Count; UPSERT published_reports (POST, then PATCH); Last_Delivered_At of each subscriber sent since `Since`; POST /api/jobs/<_job> done. A Failed or unknown report writes nothing"]
        typical_seconds: 6
        credits: 62
        runs_per_month: 46
```
Also: `MARKET_REPORT.constants` gains `max_age_hours: 48` (stale items dropped — the Moneycontrol top-news feed still serves
2016 items, the Global Cues search returns months-old ones); the BROADCAST.send / retry rules gain "then POST MARKET_PUBLISH";
DAILY_SCHEDULE's second rule (the watchdog) moves to DAILY_WATCHDOG. Webhook URLs between flows are constants
(`SET_IN_STUDIO_*_WEBHOOK_URL`), not app env vars — the app calls only WEBHOOK_MARKET_REPORT and WEBHOOK_BROADCAST.

