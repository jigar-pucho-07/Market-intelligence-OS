# 03 — App Flow · Market Intelligence
## Pages
- **overview** `/` — This morning's exceptions first, then the month's delivery numbers
- **today** `/today` — The 6 AM report as subscribers will read it, with review, send and re-run
- **reports** `/reports` — Every daily report, its views and who received it
- **news** `/news` — Every article the runs analysed, by category, impact and source
- **pipeline** `/pipeline` — The workflow steps, its configuration and every run with its source counts and errors
- **subscribers** `/subscribers` — Who receives the report by email
- **deliveries** `/deliveries` — Every WhatsApp sent, with its status — retry the failed ones
- **activity** `/activity` — Every change by a person or a flow
- **me_today** `/me` — This morning's report, as sent on WhatsApp, in full
- **me_reports** `/me/reports` — Every report that was sent
- **settings** `/settings` — Profile, password and theme
- **users** `/users` — Everyone who can sign in, and what each role may open
## Navigation and look
Shell per portal: desk=sidebar, reader=sidebar (`src/config/design.js`); nav from `src/config/nav.js`; tone pucho, radius pucho, density comfortable, sidebar light (`src/config/tokens.css`); header title = active page label. Login → first permitted page. Roles: admin (overview, today, reports, news, pipeline, subscribers, deliveries, activity, settings, users), analyst (overview, today, reports, news, pipeline, subscribers, deliveries, settings), subscriber (me_today, me_reports, settings).
## Workflow wiring (screen → flow.action)
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
## States
Every table: loading skeleton, empty state with CTA, search, filters, segments/period chips where declared, table/cards/kanban views where declared, export. Every modal: validation, pending label, toast, refresh.
