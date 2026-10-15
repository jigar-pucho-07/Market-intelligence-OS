# Wiring map · Market Intelligence
_Generated 2026-10-15._

## Screen → flow.action
- Overview `/` → `BROADCAST.send` (Send to subscribers), `MARKET_REPORT.run` (Re-run report now), `BROADCAST.retry` (Retry delivery)
- Today's report `/today` → `MARKET_REPORT.run` (Run report now), direct patch (Review & edit report), `BROADCAST.send` (Send to subscribers), document report_pdf
- Reports `/reports` → direct patch (Review & edit report), `BROADCAST.send` (Send to subscribers), document report_pdf
- News feed `/news` → no workflow
- Pipeline `/pipeline` → `MARKET_REPORT.run` (Re-run report now)
- Subscribers `/subscribers` → direct insert (Add subscriber), direct patch (Edit subscriber), direct patch (Pause)
- Deliveries `/deliveries` → `BROADCAST.retry` (Retry delivery)
- Activity `/activity` → no workflow
- Today's report `/me` → no workflow
- Past reports `/me/reports` → document reader_pdf
- Settings `/settings` → no workflow
- Users & roles `/users` → no workflow

## Flows
- **DAILY_SCHEDULE** — trigger `schedule.every_day`; writes reports
  - `trigger` — model none, ~4s, ~4 credits; payload Trigger → result queued
- **MARKET_REPORT** — trigger `webhook.catch_webhook`; writes reports, news_articles, audit_log
  - `run` — model none, ~45s, ~16 credits; payload Trigger, Report_ID → result Report_ID, Status, Articles_Analyzed
- **BROADCAST** — trigger `webhook.catch_webhook`; writes reports, published_reports, deliveries, subscribers, audit_log
  - `send` — model none, ~30s, ~105 credits; payload Report_ID → result sent, failed, skipped
  - `retry` — model none, ~6s, ~6 credits; payload Delivery_ID → result sent

## Credit estimate
| action | model | runs/month | credits/run | credits/month |
|---|---|---|---|---|
| `DAILY_SCHEDULE.trigger` | none | 44 | 4 | 176 |
| `MARKET_REPORT.run` | none | 30 | 16 | 480 |
| `BROADCAST.send` | none | 26 | 105 | 2,730 |
| `BROADCAST.retry` | none | 20 | 6 | 120 |
| **total** | | | | **3,506** credits ≈ ₹1,052 / month (declared; `docs/estimate.md` is the client page and is re-counted on the built flows at step 6) |

Credits are the only unit the client is quoted — no plan fit. Per-step base per `flow/credit-table.md`.
