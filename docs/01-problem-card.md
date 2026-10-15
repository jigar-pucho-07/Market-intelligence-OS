# Problem card — Market Intelligence (Daily Market Intelligence - WhatsApp Report)

**Outcome in the source's words:** "Analyze the following financial and national news from the past 24 hours and provide a
comprehensive market outlook for TODAY's trading session" — a Daily Market Intelligence report on WhatsApp before
"Market Opens: 9:15 AM IST", "Powered by AI Market Intelligence". Traders need clear calls, not vague statements.

**Actors:** Admin · Market Analyst (runs, reviews, re-runs, sends) · Subscriber (the client on WhatsApp; reads the report)
**Inputs:** Economic Times Markets RSS · Moneycontrol RSS · Reuters India RSS · Google Finance News RSS (India stock market Nifty
Sensex) · Global Market Cues RSS (SGX Nifty, US markets, Dow Jones, NASDAQ)
**Outputs:** the Daily Market Intelligence report (overall market sentiment, confidence level, key market drivers today,
segment-wise analysis, top sectors to watch, key risks today, trading strategy suggestion, disclaimer) · a WhatsApp message ·
an error alert · the news feed · the run log
**Volume (assumed ⚑):** 22 scheduled runs / month (Mon–Fri) + ~8 manual re-runs; 40 news articles analysed per run; ~50 subscribers
**Language:** English report; disclaimer line in Hinglish ("Yeh AI-generated analysis hai. SEBI-registered investment advisory
nahi hai.")
**Systems:** RSS feeds, Groq llama-3.3-70b (→ Studio llm-ai), Meta WhatsApp Cloud API v19.0 (→ pucho-whatsapp), n8n (→ Pucho Studio)
**Success:** the report reaches every active subscriber by 06:15 IST on every trading day; a failed run is seen by an analyst
before 07:00
**Constraints:** Not SEBI-registered advice — the disclaimer is on every report and screen; Mon–Fri only; IST throughout

## Requirement lines

R1  Schedule Trigger runs the report Mon–Fri at 6:00 AM IST
R2  Fetch ET Markets, Moneycontrol, Reuters India, Google Finance News and Global Market Cues RSS; a failed source does not stop the run
R3  Parse every RSS item into title, summary (HTML stripped, up to 300 characters), date and source
R4  Deduplicate news by the first 60 characters of the normalised title
R5  Categorize news as Macro Economic, Benchmark Index, Banking Sector, IT Sector, Pharma Sector, Auto Sector, Commodity, Global Cues, F&O or General Market
R6  Keep the 40 most relevant articles and count them by category
R7  AI analysis as a senior Indian stock market analyst: overall market sentiment, confidence level, key market drivers, segment-wise analysis (Sensex, Nifty 50, Bank Nifty, Nifty F&O with VIX expectation, Mid Cap & Small Cap), top sectors to watch, key risks, trading strategy
R8  Format the WhatsApp message with the day, date and report time in IST, the analysis and the footer "Market Opens: 9:15 AM IST", within the WhatsApp limit
R9  Send the report on WhatsApp
R10 Log the result: status, WhatsApp message id, sent at, report date
R11 Send an error alert on WhatsApp when the report cannot be generated
R12 Show the workflow pipeline with each step's status and the error branch
R13 Show today's market sentiment: sentiment, confidence, key market drivers, news analyzed, AI model, report generated time, sources
R14 Show the stats row: Sensex expected move, Nifty expected move, India VIX, FII net buy
R15 Show segment-wise analysis cards: Sensex, Nifty 50, Bank Nifty, Nifty F&O (VIX, PCR), Mid & Small Cap (focus sectors), Commodities (gold, crude)
R16 Show the sector watch: sector, call (BUY / WATCH / AVOID), previous performance, key reason
R17 Show the trading strategy (positional, intraday, long-term, F&O traders) and key risks today with their level
R18 Show the news feed with category filter chips, impact, source and time
R19 Show the active news sources
R20 Show the WhatsApp delivery preview
R21 Show the workflow configuration: trigger schedule, timezone, AI model, temperature, max tokens, news limit, WhatsApp API, delivery days, error handling
R22 Show a live ticker (Sensex, Nifty 50, Bank Nifty, Nifty IT, India VIX, USD/INR, Gold MCX, Crude WTI, SGX Nifty, FII net, Dow Jones, NASDAQ), the IST clock and the market-open countdown
R23 Every report and screen carries the disclaimer: AI analysis only, not SEBI-registered investment advisory
R24 The analyst reviews and edits today's report, re-runs it, and resends it
R25 Subscribers sign in to read today's report and past reports
R26 The analyst adds, pauses and removes WhatsApp subscribers
R27 Failed runs and failed deliveries land in an exception queue for a person
R28 Production launch: sign-in, roles, audit log, security baseline, deployable bundle

## Gaps (material unknowns only — flagged ⚑ in os.yaml)

G1 Number of subscribers (assumed 50) — drives the broadcast credits
G2 WhatsApp sending account on whatsapp.pucho.ai and approval of the two templates (mi_daily_report, mi_run_failed)
G3 NSE trading holidays — send on a weekday holiday or skip? (v1 sends Mon–Fri as the source does)
G4 A working replacement for the retired Reuters India feed (feeds.reuters.com)
G5 A licensed market-data feed for the live ticker, VIX, PCR, FII, gold and crude (not in the source)
