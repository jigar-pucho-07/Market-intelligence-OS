# Requirement traceability
Every client requirement and where the OS covers it. `scaffold_os.py` refuses to build while any row is empty.

| id | requirement | covered by |
|---|---|---|
| R1 | Schedule Trigger runs the report Mon–Fri at 6:00 AM IST | flow DAILY_SCHEDULE; flow MARKET_REPORT |
| R2 | Fetch ET Markets, Moneycontrol, Reuters India, Google Finance News and Global Market Cues RSS; a failed source does not stop the run | page pipeline; flow MARKET_REPORT |
| R3 | Parse every RSS item into title, summary (HTML stripped, up to 300 characters), date and source | page news; flow MARKET_REPORT; rule 1 |
| R4 | Deduplicate news by the first 60 characters of the normalised title | page news; flow MARKET_REPORT; rule 1 |
| R5 | Categorize news as Macro Economic, Benchmark Index, Banking Sector, IT Sector, Pharma Sector, Auto Sector, Commodity, Global Cues, F&O or General Market | page news; flow MARKET_REPORT; rule 1 |
| R6 | Keep the 40 most relevant articles and count them by category | page news; flow MARKET_REPORT; rule 1 |
| R7 | AI analysis as a senior Indian stock market analyst: sentiment, confidence, drivers, segment-wise analysis, top sectors, key risks, trading strategy | flow MARKET_REPORT; rule 5 |
| R8 | Format the WhatsApp message with the day, date and report time in IST, the analysis and the footer Market Opens: 9:15 AM IST, within the WhatsApp limit | flow MARKET_REPORT; rule 2 |
| R9 | Send the report on WhatsApp | page overview › modal send_now; page today › modal send_all; page reports › modal send_all; flow BROADCAST; rule 4 |
| R10 | Log the result: status, WhatsApp message id, sent at, report date | page reports; page deliveries; flow MARKET_REPORT; flow BROADCAST |
| R11 | Send an error alert on WhatsApp when the report cannot be generated | page pipeline; flow DAILY_SCHEDULE; flow BROADCAST; rule 3 |
| R12 | Show the workflow pipeline with each step's status and the error branch | page pipeline; page pipeline › custom |
| R13 | Show today's market sentiment: sentiment, confidence, key market drivers, news analyzed, AI model, report generated time, sources | page overview; page today; page today › custom; page me_today; page me_today › custom |
| R14 | Show the stats row: Sensex expected move, Nifty expected move, India VIX, FII net buy | deferred (not_in_v1) |
| R15 | Show segment-wise analysis cards: Sensex, Nifty 50, Bank Nifty, Nifty F&O (VIX, PCR), Mid & Small Cap, Commodities (gold, crude) | page today; page today › custom; page me_today; page me_today › custom; deferred 3 |
| R16 | Show the sector watch: sector, call (BUY / WATCH / AVOID), previous performance, key reason | page today; page today › custom; page me_today; page me_today › custom; rule 5; deferred 3 |
| R17 | Show the trading strategy (positional, intraday, long-term, F&O traders) and key risks today with their level | page today; page today › custom; page me_today; page me_today › custom; rule 5 |
| R18 | Show the news feed with category filter chips, impact, source and time | page today; page today › table; page news; page me_today; page me_today › table |
| R19 | Show the active news sources | page today; page today › custom; page news |
| R20 | Show the WhatsApp delivery preview | page today; page today › custom; rule 2 |
| R21 | Show the workflow configuration: schedule, timezone, AI model, temperature, max tokens, news limit, WhatsApp API, delivery days, error handling | page pipeline; page pipeline › custom |
| R22 | Show a live ticker, the IST clock and the market-open countdown | deferred (not_in_v1) |
| R23 | Every report and screen carries the disclaimer: AI analysis only, not SEBI-registered investment advisory | page today; page today › custom; page me_today; page me_today › custom; page me_reports; rule 2; rule 5; document report_pdf; document reader_pdf |
| R24 | The analyst reviews and edits today's report, re-runs it, and resends it | page overview › modal rerun; page today; page today › modal run_now; page today › modal review; page today › modal send_all; page reports; page reports › modal review; page pipeline › modal rerun; document report_pdf |
| R25 | Subscribers sign in to read today's report and past reports | page me_today; page me_reports; rule 6; document reader_pdf |
| R26 | The analyst adds, pauses and removes WhatsApp subscribers | page subscribers; page subscribers › modal add_subscriber; page subscribers › modal edit_subscriber; page subscribers › modal set_status; rule 4; deferred 4 |
| R27 | Failed runs and failed deliveries land in an exception queue for a person | page overview; page overview › modal retry; page pipeline; page deliveries; page deliveries › modal retry; flow BROADCAST; rule 3; header |
| R28 | Production launch: sign-in, roles, audit log, security baseline, deployable bundle | page activity; page settings; rule 6; rule 7 |
