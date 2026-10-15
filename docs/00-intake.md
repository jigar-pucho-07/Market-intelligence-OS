# 00 · Intake — Market Intelligence OS

Source: an existing automation and its dashboard, not a client document (method/intake.md Part B):

- `docs/source/n8n-daily-market-intelligence.json` — n8n workflow "Daily Market Intelligence - WhatsApp Report" (13 nodes)
- `docs/source/market-intelligence-dashboard.html` — "Market Intelligence Dashboard", a static simulation of the same report

Requested by kahsyap@pucho.ai on 15 Oct 2026: "use pucho skill file and create a full stack web app that include frontend,
database, workflows, with detailed QA and QC … use the given files and reference for the project".

## Answers (AskUserQuestion, 15 Oct 2026)

| # | question | answer |
|---|---|---|
| 2 | Users | **Analyst + subscribers.** The admin/analyst runs and reviews reports and manages WhatsApp subscribers. Subscribers sign in to read today's report and history. |
| 4 | Automation | **Runs daily on its own; the analyst can review.** 6:00 AM IST Mon–Fri, sent automatically. Failures go to an exception queue with an error alert. The analyst can re-run or resend. |
| 5 | Stage | **Production launch.** Full security audit to 0 Critical / 0 High, plus the CP Portal bundle. |
| 7 | Look | **Pucho default + dark mode.** Keep the dashboard's interactions (sentiment hero, segment cards, sector watch, news chips, WhatsApp preview), not its palette. |
| 6 | For whom | Not asked. The source sends to one `YOUR_CLIENT_WHATSAPP_NUMBER`, so this is **one client's OS** (`os.mode: client`). The client is not named, so the OS carries the dashboard's own name, "Market Intelligence". |
| — | Parity | **Parity with the workflow, subset of the dashboard.** Every n8n node is rebuilt. Dashboard panels that need data the workflow never fetches (live ticker, VIX/PCR/FII figures, gold/crude prices, sector "prev. perf") are deferred with a reason. |

Environment (first pass): Node 24.19, Git 2.55, PostgreSQL 18 (service running on :5432), Python 3.12.10 installed for the
gates (winget, official package), Playwright Chromium. The app's dev database is a **separate cluster on 127.0.0.1:5433**
(`.devdb/` beside the repo), so the existing server on :5432 and its `sales_quotation` database are never touched. The app
listens on **PORT=5000** (the owner's setting).

Hard locks: none conflict. The source uses Groq `llama-3.3-70b-versatile` for the analysis. In the OS the AI step is Studio's
`llm-ai` (model class `standard`). Groq is not a Studio connection here, so a model id is never invented (contract rule 5).

## Build brief (one screen)

**Build.** Every weekday at 06:00 IST a Studio flow fetches the five market RSS feeds. Code parses, de-duplicates and
categorises up to 40 articles and tags their impact. One AI call writes the pre-market analysis as typed fields (sentiment,
confidence, drivers, Sensex / Nifty / Bank Nifty / F&O / Mid-Small / Commodities, sectors, risks, strategy). Code formats
the WhatsApp text and stores the report and its articles. The report then goes to every active subscriber, and each delivery
is logged. A failed run or delivery lands in Needs action and the administrators get a WhatsApp alert.
Roles: **Admin** (everything, Users & roles, audit), **Analyst** (today's report, review/edit, re-run, send, subscribers,
pipeline), **Subscriber** (own portal: today's report and the archive, read-only). Data home: the OS's own PostgreSQL.
Stage: production.

**Not in v1.** Live ticker and IST market-open countdown data. India VIX / PCR / FII figures. Gold / crude prices. Sector
"previous performance". These need a licensed NSE/BSE market-data feed, which the source never had. Also deferred: sending
the full 4,000-character report as free WhatsApp text. Meta refuses free text outside the 24-hour window, so v1 sends an
approved template carrying the headline and a link to the portal (see Outputs).

**Samples needed.** One real WhatsApp report as it reached the client. The dashboard's 01 Aug 2025 preview stands in until
then, and it is the seed.

**Business rules to confirm.**
- Sentiment set (5 values from the prompt).
- Segment outlook set: the dashboard adds CAUTIOUS to BULLISH / BEARISH / NEUTRAL.
- Sector call set: the prompt says BUY / AVOID, the dashboard adds WATCH.
- The impact tag rule (HIGH / MED / LOW): the dashboard shows it, the workflow never computes it. v1 uses a keyword rule in code.
- Holidays: NSE holidays are weekdays. Does the report still go out?

**Outputs that leave the app.**
- WhatsApp to each subscriber through `pucho-whatsapp`, as an approved template (`mi_daily_report`) because it is
  business-initiated.
- WhatsApp error alert to administrators, as template `mi_run_failed`.
- A printable report (the browser's print-to-PDF).
- Platform limit: a template body is ≤ 1,024 characters, so the full report lives in the subscriber portal.

**Simulated or unverified at this stage.**
- Studio import and live runs: no workspace API key in this session. Flows are simulated by the app until `WEBHOOK_*` is set.
  Flows are gated by `validate_flow` + `flow_sim`, not a real run.
- WhatsApp template approval.
- The five RSS endpoints from Studio's network.
- `LOOP_ON_ITEMS` and `http body.data` on a real Studio import.
- CP Portal upload contract (Q1).

**Look.** Domain: pre-market equity research for Indian traders. Tone: Pucho Design System, ink primary, brand green as the
mark. Dark mode is generated, with a header toggle. Numbers in Geist Mono. English UI; the SEBI disclaimer keeps the source's
Hinglish line.

**Risks.** Known gaps in SKILL.md that this build touches: real Studio import, `pucho-whatsapp` template sends, loop step,
`return_response` at the end of a schedule-triggered flow, CP Portal deploy. Each is labelled UNVERIFIED where it appears.

## Defects found in the source workflow (fixed in the rebuild, each becomes a test)

| # | n8n node | defect | effect | rebuild |
|---|---|---|---|---|
| S1 | Schedule Trigger + `settings.timezone: Asia/Kolkata` | cron `0 30 0 * * 1-5` is written for UTC, but the workflow timezone is IST | runs at **00:30 IST**, not 06:00 | `every_day` at 06:00, timezone Asia/Kolkata, weekends off |
| S2 | Merge All News Sources (`combine` / `multiplex`) | multiplex makes the cross-product of five inputs; each output item carries one `data` key | the parser sees combined items, and source names by index are wrong | each fetch is its own step and the parse node reads each step by name |
| S3 | Parse & Categorize | `/…|it|…/i` has no word boundary, so "it" matches *profit*, *with*, *credit* | almost every article lands in IT_SECTOR | word-bounded rules, tested on fixtures |
| S4 | Fetch Reuters India RSS | `feeds.reuters.com` was retired by Reuters (2020) | one source is always empty | kept as a source; the per-source count makes the gap visible on Pipeline; G4 asks for the replacement |
| S5 | Send WhatsApp Message | free-text `type: text` to a client who has not written in 24 h | Meta rejects it (error 131047) | approved template + portal link |
| S6 | Error Trigger / `settings.errorWorkflow: "error-trigger-001"` | `errorWorkflow` must be another workflow's id, not a node id; an Error Trigger only runs in its own workflow | the error alert never fires | the run writes `Status: Failed` + `Error_Message`, the broadcast flow alerts admins |
| S7 | Groq AI node | API key in the node's header (`Bearer YOUR_GROQ_API_KEY_HERE`) | secret in the workflow file | Studio `llm-ai`, no key in any flow file |
| S8 | Format WhatsApp Message | AI prose is pasted verbatim, so nothing is stored as data | no history, no dashboard from real runs | AI answers typed JSON, code keeps only declared keys, the report is a row |
