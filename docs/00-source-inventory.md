# 00 · Source inventory — n8n workflow + dashboard → R-lines

Licence: both files were supplied by the owner for this build (no licence line; owner's own work). No copyleft lock.
Look: Pucho default + dark mode (intake Q7). Scope: parity with the workflow, subset of the dashboard (intake).

| screen / job | what it does | source | R-line |
|---|---|---|---|
| Schedule Trigger (6:00 AM IST) | runs Mon–Fri before the 9:15 open | n8n `schedule-trigger-001` | R1 |
| Fetch ET Markets / Moneycontrol / Reuters India / Google Finance News / Global Market Cues RSS | five HTTP GETs, 10 s timeout, continue on fail | n8n `http-*-001` ×5 | R2 |
| Parse & Categorize News | RSS items → title, description (HTML stripped, ≤300 chars), pubDate, source | n8n `code-parse-news-001` | R3 |
| 〃 | dedupe on first 60 normalised title characters | 〃 | R4 |
| 〃 | 10 keyword categories | 〃 | R5 |
| 〃 | keep 40, category breakdown | 〃 | R6 |
| Groq AI Analysis | senior Indian market analyst prompt, fixed answer format, temp 0.3, 2,000 tokens | n8n `http-groq-001` | R7 |
| Format WhatsApp Message | header (day, date, IST time) + analysis + footer, ≤4,000 chars | n8n `code-format-whatsapp-001` | R8 |
| Send WhatsApp Message | Meta Cloud API to the client number | n8n `http-whatsapp-send-001` | R9 |
| Log Result | status, message id, sent at, report date | n8n `code-log-result-001` | R10 |
| Error Trigger → Send Error Alert | WhatsApp alert with error, date, IST time | n8n `error-trigger-001`, `http-error-whatsapp-001` | R11 |
| Workflow pipeline panel | every node with status, the error branch | dashboard § n8n Workflow Pipeline | R12 |
| Sentiment hero | sentiment, confidence, 3 drivers, news analysed, model, generated time, sources | dashboard § Today's Market Sentiment | R13 |
| Stats row | Sensex / Nifty expected move, India VIX, FII net buy | dashboard § stats | R14 |
| Segment cards | Sensex, Nifty 50, Bank Nifty (outlook, range, reason), F&O (call, VIX, PCR), Mid & Small cap (focus sectors), Commodities (gold, crude) | dashboard § Segment-wise Analysis | R15 |
| Sector watch | sector, call BUY / WATCH / AVOID, prev. perf, reason | dashboard § Sector Watch | R16 |
| Strategy + risks | positional / intraday / long-term / F&O strategy; risks with HIGH / MED | dashboard § Trading Strategy, Key Risks | R17 |
| News feed | category chips with counts, impact tag, source, time | dashboard § News Feed | R18 |
| Active sources legend | the five sources | dashboard § Active News Sources | R19 |
| WhatsApp delivery preview | the message as the client sees it | dashboard § WhatsApp Delivery Preview | R20 |
| Workflow configuration | schedule, timezone, model, temperature, max tokens, news limit, API, days, error handling | dashboard § Workflow Configuration | R21 |
| Live ticker + clock + countdown | Sensex … NASDAQ values, IST clock, market-open countdown | dashboard § ticker, script | R22 |
| Disclaimer | "not SEBI-registered advisory", on the message and the page | n8n prompt, dashboard footer | R23 |
| (intake) review | analyst reviews / edits, re-runs, resends | intake Q4 | R24 |
| (intake) subscribers read | subscribers sign in to today's report and history | intake Q2 | R25 |
| (intake) subscriber list | analyst adds, pauses, removes WhatsApp subscribers (the source had one number) | intake Q2 | R26 |
| (intake) exception queue | failed runs and deliveries wait for a person | intake Q4 | R27 |
| (intake) production | sign-in, roles, audit, security baseline, portal bundle | intake Q5 | R28 |
