# Test cases · Market Intelligence
| # | area | step | expected |
|---|---|---|---|
| T1 | DAILY_SCHEDULE.trigger | call with the sample payload | result keys queued; row in reports |
| T2 | MARKET_REPORT.run | call with the sample payload | result keys Report_ID, Status, Articles_Analyzed; row in reports, news_articles, audit_log |
| T3 | BROADCAST.send | call with the sample payload | result keys sent, failed, skipped; row in reports, published_reports, deliveries, subscribers, audit_log |
| T4 | BROADCAST.retry | call with the sample payload | result keys sent; row in reports, published_reports, deliveries, subscribers, audit_log |
| U1 | login | each persona signs in | sees only its pages; sign-out works |
| U2 | every page | demo data | KPIs, charts, table, search, export, each modal succeeds with a toast |
| U3 | detail routes | open from an id link | fields, related tables, custom sections |
| U4 | role guard | sales opens /masters | redirected |
| U5 | wired | every WEBHOOK_<FLOW> set, header shows no simulated chip | a create action runs the flow and the row appears within 30 s |
| U6 | sign-in | wrong password / unknown email | the same message; a deactivated person cannot sign in and their open session ends |
