# 00 — Decisions · Market Intelligence
_Generated from os.yaml. The step-2 summary: roles and homes, journeys, entities, metrics, sections, actions, flows, overview, theme, tier, not in v1 (`method/os-decisions.md`)._

## D1 · Roles and homes
| role | lands on | pages | in their words |
|---|---|---|---|
| Admin | `/` | overview, today, reports, news, pipeline, subscribers, deliveries, activity, settings, users | Runs the desk, people and roles, and sees the audit log |
| Market Analyst | `/today` | overview, today, reports, news, pipeline, subscribers, deliveries, settings | Checks the 6 AM report, edits it, re-runs it and sends it to subscribers |
| Subscriber | `/me` | me_today, me_reports, settings | Reads today's report and past reports |

## D2 · Journeys
- **analyst** · Check the 6 AM report and send it — lands on `today` · 3 steps: Today's report opens on the sentiment and segments → Review & edit on the report row (only if a view needs changing) → Send to subscribers on the same row
- **analyst** · Recover a failed run — lands on `pipeline` · 3 steps: Pipeline opens on the run log, Failed segment → Read the error and source counts on the row → Re-run report now on the row
- **admin** · Clear this morning's exceptions — lands on `overview` · 2 steps: Overview opens on Needs action → Send / Retry delivery / Re-run on the row
- **admin** · Add a subscriber — lands on `subscribers` · 2 steps: Subscribers → Add subscriber → Name, email, opt-in date and how they opted in → Add
- **subscriber** · Read today's report before the open — lands on `me_today` · 2 steps: Today's report opens on sentiment, drivers and segments → Scroll to sectors, risks, the market view and news

## D3 · Entities
| entity | title | subtitle | owner | due | contact | stages |
|---|---|---|---|---|---|---|
| reports | Report_Date | Sentiment |  |  |  | Ready → Sent → Failed |
| published_reports | Report_Date | Sentiment |  |  |  |  |
| news_articles | Title | Source |  |  |  |  |
| subscribers | Name | City |  |  | whatsapp=WhatsApp, phone=WhatsApp, email=Email | Active → Paused → Unsubscribed |
| deliveries | Subscriber_Name | Report_Date |  |  |  | Queued → Sent → Failed |
| audit_log |  |  |  |  |  |  |

Data: **PostgreSQL** (one database per client, single-tenant) · security: **§19 baseline** (`docs/security.md`)

## D4 · Metrics
| metric | label | entity | where | tone |
|---|---|---|---|---|
| `ready_unsent` | Reports not sent | reports | `Status=Ready` | warn |
| `failed_runs` | Failed runs (7 days) | reports | `Status=Failed and Created_At in last 7 days` | bad |
| `failed_deliveries` | Failed deliveries (7 days) | deliveries | `Status=Failed and Kind=Report and Sent_At in last 7 days` | bad |
| `reports_sent` | Reports sent this month | reports | `Status=Sent and Report_Date in month` | ok |
| `active_subs` | Active subscribers | subscribers | `Status=Active` | info |
| `news_today` | News analysed today | news_articles | `Fetched_At in last 1 days` | info |

## D5 · Sections — the shape of each
| page | section | shape |
|---|---|---|
| Overview | Needs action | needs_action: ready_unsent · failed_runs · failed_deliveries |
| Today's report | custom | custom |
| Today's report | tabs | tabs: Today's report, Today's news |
| Today's report | reports | table; drawer per row |
| Today's report | news_articles | table; drawer per row |
| Reports | reports | table / cards; drawer per row |
| News feed | kpis | kpis (strip) |
| News feed | news_articles | table; drawer per row |
| Pipeline | custom | custom |
| Pipeline | reports | table; drawer per row |
| Subscribers | kpis | kpis (strip) |
| Subscribers | subscribers | table; bulk set_status, delete_subscriber; drawer per row |
| Deliveries | kpis | kpis (strip) |
| Deliveries | deliveries | table; drawer per row |
| Activity | kpis | kpis (strip) |
| Activity | audit_log | table; centred pop-up per row |
| Today's report | custom | custom |
| Today's report | news_articles | table; drawer per row |
| Past reports | published_reports | cards / table; drawer per row |

## D6 · Actions
| page | action | shape |
|---|---|---|
| Overview | Send to subscribers | status: 0 fields · BROADCAST |
| Overview | Re-run report now | status: 0 fields · MARKET_REPORT |
| Overview | Retry delivery | status: 0 fields · BROADCAST |
| Today's report | Run report now | create: 1 field · MARKET_REPORT |
| Today's report | Review & edit report | edit: 7 fields · direct |
| Today's report | Send to subscribers | status: 0 fields · BROADCAST |
| Today's report | Print report | document · direct |
| Today's report | Download PDF | document · direct |
| Reports | Review & edit report | edit: 7 fields · direct |
| Reports | Send to subscribers | status: 0 fields · BROADCAST |
| Reports | Print report | document · direct |
| Pipeline | Re-run report now | status: 0 fields · MARKET_REPORT |
| Subscribers | Add subscriber | create: 7 fields · direct |
| Subscribers | Edit subscriber | edit: 4 fields · direct |
| Subscribers | Pause | status: 1 field · direct |
| Subscribers | Delete subscriber | edit: 0 fields · direct |
| Deliveries | Retry delivery | status: 0 fields · BROADCAST |
| Past reports | Print report | document · direct |

## D7 · Flows and AI
- **DAILY_SCHEDULE** — `schedule.every_day`; actions trigger; no model call
- **MARKET_REPORT** — `webhook.catch_webhook`; actions run, rerun; no model call
- **BROADCAST** — `webhook.catch_webhook`; actions send, retry; no model call
- **DAILY_WATCHDOG** — `schedule.cron_expression`; actions check; no model call
- **MARKET_ANALYSE** — `webhook.catch_webhook`; actions run, rerun; no model call
- **MARKET_STORE** — `webhook.catch_webhook`; actions store; no model call
- **MARKET_PUBLISH** — `webhook.catch_webhook`; actions publish; no model call
- Rules in code: RSS parse, dedupe (first 60 normalised title characters), word-bounded categorisation in the source's order, impact rule and the 40-article cut are deterministic CODE in MARKET_REPORT (S2, S3 fixed); WhatsApp text is built by one formatter (app/src/custom/lib/market.js) used by the flow and by the app's preview: header with day, date and report time in IST, the analysis, 'Market Opens: 9:15 AM IST', the disclaimer; trimmed to 4,000 characters; A failed run (no articles, model JSON unusable) is a report row with Status Failed and Error_Message; MARKET_REPORT always hands it to BROADCAST, which sends the mi_run_failed alert to constants.alert_to; the 06:20 watchdog alerts when no row exists at all — replaces the source's Error Trigger, which could never fire (S6); Subscriber messages are business-initiated, so they use the approved template mi_daily_report (Meta refuses free text outside the 24-hour window, S5); only Active subscribers with an opt-in date and source receive it; one delivery per report per subscriber (unique), so a resend never duplicates; SEBI (owner decision 15 Oct 2026): commentary only — the prompt forbids buy/sell calls, strikes, targets and stop-losses; the source's BUY CALLS / BUY PUTS, BUY / AVOID and 'trading strategy' become an F&O positioning view, sectors POSITIVE / WATCH / NEGATIVE and a market view per trader type; the disclaimer is on every report, document, the reader portal and the template; Subscribers read only published_reports (a reader-safe copy BROADCAST writes when a report is sent) and today's news; drafts, failures, deliveries, subscribers and the audit log are not on any subscriber page, so the server never loads them for that role; Every write by a person or a flow lands in the audit log; sign-in, roles, server-side scope and the §19 baseline ship with v1; go-live requires /api/health to report every flow wired (an unwired flow is simulated and labelled SIMULATED in the header and the row)

## D8 · Overview order
- Needs action (ready_unsent · failed_runs · failed_deliveries) → KPI strip → charts: trend, breakdown → recent

## D9 · Shell & look
- Brand `#0B8F6A` → primary **brand** (red is overdue / lost / destructive only); mark: monogram
- Shell: desk → sidebar · reader → sidebar
- Look: tone pucho · face geist (login stays IBM Plex) · edges pucho · canvas paper · radius pucho · density comfortable · labels mono · sidebar light
- Direction: Analysts read one dense report each morning; numbers in mono, status carries the colour, dark mode for the early start

## D11 · Not in v1
- Live ticker values (Sensex, Nifty, Bank Nifty, Nifty IT, VIX, USD/INR, Gold, Crude, SGX Nifty, FII, Dow, NASDAQ), IST clock and market-open countdown — the source has no market-data feed; needs a licensed NSE/BSE data API (G5). v1 shows the AI's ranges in focus _(covers R22)_
- Stats row figures — Sensex/Nifty expected move in points, India VIX level, FII net buy amount — need the same market-data feed (G5); v1 shows the ranges and the VIX expectation (LOW/MEDIUM/HIGH) from the analysis _(covers R14)_
- Sector 'previous performance' %, PCR ratio and gold / crude prices on the segment cards — not in the news data; need the market-data feed (G5) _(covers R15, R16)_
- A 'Stop' quick-reply on the template that unsubscribes automatically — needs an inbound WhatsApp webhook; v1: the analyst sets Unsubscribed when a subscriber replies STOP _(covers R26)_

## Footprint (lean frontend, v4.3)
- footprint: 10 pages in the nav (0 hidden) · 15 KPIs · 2 charts · 18 modals · 3 drawer tabs · for 28 requirements
- Budget: overview ≤ 4 KPIs · ≤ 2 charts · ≤ 3 queues; a page ≤ 4 KPIs · ≤ 6 modals · drawer ≤ 3 tabs; nav pages ≤ requirements. Pages marked `badge: Preview` stay off the nav until `os.show_preview: true`.
- Within budget.

## Definition of done
Tick against this page before step 3, and against the screenshots before step 4 (`method/os-decisions.md`).
