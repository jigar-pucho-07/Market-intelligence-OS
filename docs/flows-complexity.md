# Workflow complexity

Budget per action path: ≤ 14 steps · ≤ 1 AI call (2 with a code check between) · no nested router · no CODE node > 40 lines · no two CODE nodes in a row. Per flow: ≤ 12 actions.

## BROADCAST — 4 action(s), longest path 10 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| send | alert | 9 | 0 | 1 | — |
| retry | 10 | 0 | 1 | — |
| Unknown action → 400 | 4 | 0 | 1 | — |
| Anything else → 401 | 4 | 0 | 1 | — |

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

## MARKET_ANALYSE — 5 action(s), longest path 14 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| Authorised › No news → Failed row | 12 | 0 | 1 | — |
| Authorised › Analyse | 14 | 1 | 1 | — |
| Authorised › Invalid | 11 | 0 | 1 | — |
| Unknown action → 400 | 4 | 0 | 1 | — |
| Anything else → 401 | 4 | 0 | 1 | — |

## MARKET_PUBLISH — 3 action(s), longest path 9 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| Authorised | 9 | 0 | 1 | — |
| Unknown action → 400 | 4 | 0 | 1 | — |
| Anything else → 401 | 4 | 0 | 1 | — |

## MARKET_REPORT — 4 action(s), longest path 8 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| Authorised › Refuse (today's report exists / not Failed / app closed) → 409 | 8 | 0 | 1 | — |
| Authorised › Analyse | 8 | 0 | 1 | — |
| Unknown action → 400 | 4 | 0 | 1 | — |
| Anything else → 401 | 4 | 0 | 1 | — |

## MARKET_STORE — 6 action(s), longest path 12 steps, within budget

| action path | steps | AI calls | router depth | longest CODE |
|---|---:|---:|---:|---:|
| Authorised › Refuse (exists / Sent / not Failed / app closed) | 8 | 0 | 1 | — |
| Authorised › New report (POST) | 12 | 0 | 1 | — |
| Authorised › Re-run (PATCH) | 12 | 0 | 1 | — |
| Authorised › Unexpected | 7 | 0 | 1 | — |
| Unknown action → 400 | 4 | 0 | 1 | — |
| Anything else → 401 | 4 | 0 | 1 | — |


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
| MARKET_REPORT | Authorised › Refuse (today's report exists / not Failed / app closed) → 409 | 9 | 6 + step_refuse_job_loop×1 |
| MARKET_REPORT | Authorised › Analyse | 8 | 6 |
| MARKET_REPORT | Unknown action → 400 | 4 | 3 |
| MARKET_REPORT | Anything else → 401 | 4 | 3 |
| MARKET_ANALYSE | Authorised › No news → Failed row | 12 | 10 |
| MARKET_ANALYSE | Authorised › Analyse | 14 | 12 |
| MARKET_ANALYSE | Authorised › Invalid | 11 | 9 |
| MARKET_ANALYSE | Unknown action → 400 | 4 | 3 |
| MARKET_ANALYSE | Anything else → 401 | 4 | 3 |
| MARKET_STORE | Authorised › Refuse (exists / Sent / not Failed / app closed) | 9 | 6 + step_refuse_job_loop×1 |
| MARKET_STORE | Authorised › New report (POST) | 14 | 10 + step_new_bc_loop×1 + step_new_job_loop×1 |
| MARKET_STORE | Authorised › Re-run (PATCH) | 14 | 10 + step_rerun_bc_loop×1 + step_rerun_job_loop×1 |
| MARKET_STORE | Authorised › Unexpected | 7 | 5 |
| MARKET_STORE | Unknown action → 400 | 4 | 3 |
| MARKET_STORE | Anything else → 401 | 4 | 3 |
| BROADCAST | send | alert | 14 | 8 + step_send_loop×5 |
| BROADCAST | retry › inner Return | 14 | 13 |
| BROADCAST | retry ›  (0 items) | 10 | 9 |
| BROADCAST | Unknown action → 400 | 4 | 3 |
| BROADCAST | Anything else → 401 | 4 | 3 |
| MARKET_PUBLISH | Authorised | 13 | 8 + step_pub_loop×3 + step_job_loop×1 |
| MARKET_PUBLISH | Unknown action → 400 | 4 | 3 |
| MARKET_PUBLISH | Anything else → 401 | 4 | 3 |

Longest path with loop bodies counted: **14 steps** (budget 14).

## The four flows the owner adds to os.yaml (the builder made them; os.yaml is the owner's)

Why the split: one Studio flow has one trigger, so the 06:20 watchdog cannot live in DAILY_SCHEDULE. Security round 1 then put
the webhook secret check and today's report state in front of every paid step (SA-01..SA-04). One flow cannot do all of it in
14 steps: secret, read today's row, decide, 5 fetches, parse, AI, parse, write, stamp the news, write news, BROADCAST, job,
Return is over 20. A second decision inside a branch would be a router in a router. So the work is a chain of short flows:
MARKET_REPORT (the app's door: secret → today's row → refuse or go) → MARKET_ANALYSE (feeds + the one AI call) → MARKET_STORE
(the writer, which re-checks every field) → BROADCAST → MARKET_PUBLISH (counts, reader copy, job). Each flow-to-flow call carries
?k=<the callee's secret>. No app page calls the four new flows.

```yaml
  - name: DAILY_WATCHDOG
    covers: [R11]
    trigger: { tool: schedule, name: cron_expression }      # "20 6 * * 1-5", Asia/Kolkata
    constants: { holidays: [] }                             # the SAME list as DAILY_SCHEDULE
    writes: []
    actions:
      - name: check
        model: none
        via: custom
        payload: {}
        result: { alerted: boolean }
        rules: ["06:20 IST Mon–Fri: GET reports; no row for today (or the app unreadable) → POST BROADCAST {action: alert} ?k= → Return. BROADCAST writes the fixed alert text"]
        typical_seconds: 4
        credits: 5
        runs_per_month: 22
  - name: MARKET_ANALYSE
    covers: [R2, R3, R4, R5, R6, R7, R8]
    trigger: { tool: webhook, name: catch_webhook, auth: none }   # ?k= checked in the first step
    constants: { news_limit: 40, summary_chars: 300, dedupe_chars: 60, max_age_hours: 48 }
    writes: []
    actions:
      - name: run
        model: none
        via: custom
        payload: { Trigger: string, Report_ID: string }
        result: { Status: string, Articles_Analyzed: number }
        rules: ["Called only by MARKET_REPORT. Five RSS GETs (feeds.* constants) → parse / dedupe / categorise / impact → no news → Failed row; else ONE llm-ai call → parse + check → POST MARKET_STORE ?k="]
        typical_seconds: 45
        credits: 12
        runs_per_month: 30
      - name: rerun
        model: none
        via: custom
        payload: { Report_ID: string }
        result: { Status: string, Articles_Analyzed: number }
        rules: ["As run, for today's Failed report"]
        typical_seconds: 45
        credits: 12
        runs_per_month: 8
  - name: MARKET_STORE
    covers: [R10]
    trigger: { tool: webhook, name: catch_webhook, auth: none }   # ?k= checked in the first step
    constants: { auto_send: true }
    writes: [reports, news_articles]
    actions:
      - name: store
        model: none
        via: custom
        payload: { Mode: string, Trigger: string, Report_ID: string, report: object, articles: array }
        result: { Report_ID: string, Status: string }
        rules: ["Called only by MARKET_ANALYSE. Every text field re-checked (isAdvice; advice in Driver_1 → Failed 'Advice language removed — review'); the WhatsApp text rebuilt. run: no row today → POST; today's Failed → PATCH; Ready / Sent → refused. rerun: only today's Failed. Then news_articles, BROADCAST (Failed → Kind Alert; Ready → only when auto_send), POST /api/jobs/<_job>"]
        typical_seconds: 5
        credits: 13
        runs_per_month: 30
  - name: MARKET_PUBLISH
    covers: [R9, R10]
    trigger: { tool: webhook, name: catch_webhook, auth: none }   # ?k= checked in the first step
    writes: [reports, published_reports]
    actions:
      - name: publish
        model: none
        via: custom
        payload: { Report_ID: string }
        result: { sent: number, failed: number }
        rules: ["Called only by BROADCAST (after send and after retry). From the app's rows: at least one delivery Sent → report Sent + Sent_At + Sent_Count + Failed_Count and UPSERT published_reports (POST, then PATCH); none sent → left Ready, job failed NOTHING_SENT; POST /api/jobs/<_job>"]
        typical_seconds: 6
        credits: 13
        runs_per_month: 46
```
Also: MARKET_REPORT's rules become "the app's door: ?k= secret, action ∈ run | rerun, today's report read BEFORE any paid step (run refused 409
when today is Ready / Sent; rerun only for today's Failed) → POST MARKET_ANALYSE ?k=", and its feeds / limits constants move to
MARKET_ANALYSE; BROADCAST gains a flow-only action  {Report_ID} (no role holds it; the watchdog and MARKET_STORE call it), and
BROADCAST.send derives everything from the report row, never a caller Kind (SA-24): "only today's Ready report (a Sent one re-sends: the 409 skips who has it); a queued 409 → no WhatsApp,
no PATCH; Kind Alert text only from the report row or the fixed watchdog text, one Alert row per admin per attempt (ADMIN-n-HHmm)";
BROADCAST.retry: "Attempts < 3, claimed by PATCH Attempts + 1 where Attempts = the value read; only a claimed row is sent"; the
send / retry rules gain "then POST MARKET_PUBLISH ?k="; DAILY_SCHEDULE's watchdog rule moves to DAILY_WATCHDOG. Flow-to-flow URLs
and secrets are flow constants, not app env vars — the app calls only WEBHOOK_MARKET_REPORT and WEBHOOK_BROADCAST, each with ?k=.

