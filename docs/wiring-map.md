# Wiring map · Market Intelligence
_Generated 2026-10-26._

## Screen → flow.action
- Overview `/` → `BROADCAST.send` (Send to subscribers), `MARKET_REPORT.rerun` (Re-run report now), `BROADCAST.retry` (Retry delivery)
- Today's report `/today` → `MARKET_REPORT.run` (Run report now), direct patch (Review & edit report), `BROADCAST.send` (Send to subscribers), document report_pdf
- Reports `/reports` → direct patch (Review & edit report), `BROADCAST.send` (Send to subscribers), document report_pdf
- News feed `/news` → no workflow
- Pipeline `/pipeline` → `MARKET_REPORT.rerun` (Re-run report now)
- Subscribers `/subscribers` → direct insert (Add subscriber), direct patch (Edit subscriber), direct patch (Pause), direct delete (Delete subscriber)
- Deliveries `/deliveries` → `BROADCAST.retry` (Retry delivery)
- Activity `/activity` → no workflow
- Today's report `/me` → no workflow
- Past reports `/me/reports` → document reader_pdf
- Settings `/settings` → no workflow
- Users & roles `/users` → no workflow

## Flows
- **DAILY_SCHEDULE** — trigger `schedule.every_day`; writes reports
  - `trigger` — model none, ~4s, ~5 credits; payload Trigger → result queued
- **MARKET_REPORT** — trigger `webhook.catch_webhook`; writes reports, news_articles, audit_log
  - `run` — model none, ~45s, ~6 credits; payload Trigger, Report_ID → result Report_ID, Status, Articles_Analyzed
  - `rerun` — model none, ~45s, ~6 credits; payload Report_ID → result Report_ID, Status, Articles_Analyzed
- **BROADCAST** — trigger `webhook.catch_webhook`; writes reports, published_reports, deliveries, audit_log
  - `send` — model none, ~30s, ~258 credits; payload Report_ID → result sent, failed, skipped
  - `retry` — model none, ~6s, ~13 credits; payload Delivery_ID → result sent
- **DAILY_WATCHDOG** — trigger `schedule.cron_expression`; writes reports
  - `check` — model none, ~4s, ~5 credits; payload  → result alerted
- **MARKET_ANALYSE** — trigger `webhook.catch_webhook`; writes reports, audit_log
  - `run` — model none, ~45s, ~19 credits; payload Trigger, Report_ID → result Status, Articles_Analyzed
  - `rerun` — model none, ~45s, ~19 credits; payload Report_ID → result Status, Articles_Analyzed
- **MARKET_STORE** — trigger `webhook.catch_webhook`; writes reports, news_articles, audit_log
  - `store` — model none, ~5s, ~12 credits; payload Mode, Trigger, Report_ID → result Report_ID, Status
- **MARKET_PUBLISH** — trigger `webhook.catch_webhook`; writes reports, published_reports, audit_log
  - `publish` — model none, ~6s, ~12 credits; payload Report_ID, Since → result sent, failed

## Credit estimate
| action | model | runs/month | credits/run | credits/month |
|---|---|---|---|---|
| `DAILY_SCHEDULE.trigger` | none | 22 | 5 | 110 |
| `MARKET_REPORT.run` | none | 22 | 6 | 132 |
| `MARKET_REPORT.rerun` | none | 8 | 6 | 48 |
| `BROADCAST.send` | none | 26 | 258 | 6,708 |
| `BROADCAST.retry` | none | 20 | 13 | 260 |
| `DAILY_WATCHDOG.check` | none | 22 | 5 | 110 |
| `MARKET_ANALYSE.run` | none | 22 | 19 | 418 |
| `MARKET_ANALYSE.rerun` | none | 8 | 19 | 152 |
| `MARKET_STORE.store` | none | 30 | 12 | 360 |
| `MARKET_PUBLISH.publish` | none | 46 | 12 | 552 |
| **total** | | | | **8,850** credits ≈ ₹2,655 / month (declared; `docs/estimate.md` is the client page and is re-counted on the built flows at step 6) |

Credits are the only unit the client is quoted — no plan fit. Per-step base per `flow/credit-table.md`.
