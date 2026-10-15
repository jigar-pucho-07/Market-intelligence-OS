# 01 — PRD · Market Intelligence
_Generated 2026-10-15 from os.yaml._

**Client:** Market Intelligence — Daily pre-market report for NSE/BSE traders  
**Outcome:** A Daily Market Intelligence report reaches every subscriber on WhatsApp before the market opens at 9:15 AM IST, and the analyst sees and fixes anything that failed.  
**Languages:** en · **Volume:** ~30 events/month · **Operating cost:** see `docs/estimate.md` (credits/month, workflow-wise)

## Pages
- **overview** `/` — This morning's exceptions first, then the month's delivery numbers
- **today** `/today` — The 6 AM report as subscribers will read it, with review, send and re-run
- **reports** `/reports` — Every daily report, its views and who received it
- **news** `/news` — Every article the runs analysed, by category, impact and source
- **pipeline** `/pipeline` — The workflow steps, its configuration and every run with its source counts and errors
- **subscribers** `/subscribers` — Who receives the report on WhatsApp
- **deliveries** `/deliveries` — Every WhatsApp sent, with its status — retry the failed ones
- **activity** `/activity` — Every change by a person or a flow
- **me_today** `/me` — This morning's report, as sent on WhatsApp, in full
- **me_reports** `/me/reports` — Every report that was sent
- **settings** `/settings` — Profile, password and theme
- **users** `/users` — Everyone who can sign in, and what each role may open

## Workflows
- **DAILY_SCHEDULE** — trigger `schedule.every_day`; writes reports
  - `trigger` — model none, ~4s, ~5 credits; payload Trigger → result queued
- **MARKET_REPORT** — trigger `webhook.catch_webhook`; writes reports, news_articles, audit_log
  - `run` — model none, ~45s, ~19 credits; payload Trigger, Report_ID → result Report_ID, Status, Articles_Analyzed
  - `rerun` — model none, ~45s, ~19 credits; payload Report_ID → result Report_ID, Status, Articles_Analyzed
- **BROADCAST** — trigger `webhook.catch_webhook`; writes reports, published_reports, deliveries, audit_log
  - `send` — model none, ~30s, ~258 credits; payload Report_ID → result sent, failed, skipped
  - `retry` — model none, ~6s, ~12 credits; payload Delivery_ID → result sent
- **DAILY_WATCHDOG** — trigger `schedule.cron_expression`; writes reports
  - `check` — model none, ~4s, ~5 credits; payload  → result alerted
- **MARKET_STORE** — trigger `webhook.catch_webhook`; writes reports, news_articles, audit_log
  - `store` — model none, ~5s, ~12 credits; payload Mode, Trigger, Report_ID → result Report_ID, Status
- **MARKET_PUBLISH** — trigger `webhook.catch_webhook`; writes reports, published_reports, audit_log
  - `publish` — model none, ~6s, ~12 credits; payload Report_ID, Since → result sent, failed

## Rules in code
- RSS parse, dedupe (first 60 normalised title characters), word-bounded categorisation in the source's order, impact rule and the 40-article cut are deterministic CODE in MARKET_REPORT (S2, S3 fixed)
- WhatsApp text is built by one formatter (app/src/custom/lib/market.js) used by the flow and by the app's preview: header with day, date and report time in IST, the analysis, 'Market Opens: 9:15 AM IST', the disclaimer; trimmed to 4,000 characters
- A failed run (no articles, model JSON unusable) is a report row with Status Failed and Error_Message; MARKET_REPORT always hands it to BROADCAST, which sends the mi_run_failed alert to constants.alert_to; the 06:20 watchdog alerts when no row exists at all — replaces the source's Error Trigger, which could never fire (S6)
- Subscriber messages are business-initiated, so they use the approved template mi_daily_report (Meta refuses free text outside the 24-hour window, S5); only Active subscribers with an opt-in date and source receive it; one delivery per report per subscriber (unique), so a resend never duplicates
- SEBI (owner decision 15 Oct 2026): commentary only — the prompt forbids buy/sell calls, strikes, targets and stop-losses; the source's BUY CALLS / BUY PUTS, BUY / AVOID and 'trading strategy' become an F&O positioning view, sectors POSITIVE / WATCH / NEGATIVE and a market view per trader type; the disclaimer is on every report, document, the reader portal and the template
- Subscribers read only published_reports (a reader-safe copy BROADCAST writes when a report is sent) and today's news; drafts, failures, deliveries, subscribers and the audit log are not on any subscriber page, so the server never loads them for that role
- Every write by a person or a flow lands in the audit log; sign-in, roles, server-side scope and the §19 baseline ship with v1; go-live requires /api/health to report every flow wired (an unwired flow is simulated and labelled SIMULATED in the header and the row)

## Not in v1
- Live ticker values (Sensex, Nifty, Bank Nifty, Nifty IT, VIX, USD/INR, Gold, Crude, SGX Nifty, FII, Dow, NASDAQ), IST clock and market-open countdown — the source has no market-data feed; needs a licensed NSE/BSE data API (G5). v1 shows the AI's ranges in focus
- Stats row figures — Sensex/Nifty expected move in points, India VIX level, FII net buy amount — need the same market-data feed (G5); v1 shows the ranges and the VIX expectation (LOW/MEDIUM/HIGH) from the analysis
- Sector 'previous performance' %, PCR ratio and gold / crude prices on the segment cards — not in the news data; need the market-data feed (G5)
- A 'Stop' quick-reply on the template that unsubscribes automatically — needs an inbound WhatsApp webhook; v1: the analyst sets Unsubscribed when a subscriber replies STOP

## Success metric
Report delivered to every active subscriber by 06:15 IST on every trading day; a failed run seen by an analyst before 07:00
