#!/usr/bin/env python3
"""tools/build_market_flows.py — the Market Intelligence Studio flows, built with the pucho-os flowkit (method/ai-pipeline.md).

  python tools/build_market_flows.py            # build + gate every flow (validate --contract, complexity --strict)
  python tools/build_market_flows.py --mutate   # also prove each contract catches a deleted required step

The flow SHAPE lives here; every rule lives in app/src/custom/lib/market.js and every CODE step's body is one call into
app/src/custom/lib/market-flow.js. Each CODE node carries only the library functions it reaches, between `// lib:` and
`// end lib` (flowkit.inline_lib when rolldown is installed in app/node_modules, else the same tree-shake done here).

Seven flows (os.yaml has three; the other four keep every action path inside the simplicity budget — docs/flows-complexity.md).
Every webhook flow's FIRST step checks ?k= against its own secret (constant time, fail closed) and answers 401 before any read:
  DAILY_SCHEDULE  schedule every_day 06:00 IST, weekends off → holiday? → POST MARKET_REPORT {action: run} ?k= → Return
  DAILY_WATCHDOG  cron 06:20 IST Mon–Fri → GET reports → no row today → POST BROADCAST {action: alert} ?k= → Return
  MARKET_REPORT   webhook run | rerun (the app's door): secret → GET reports → today's state → 409 refused | POST MARKET_ANALYSE → Return
  MARKET_ANALYSE  webhook run | rerun: secret → 5 RSS GETs → CODE → router (no news / analyse) → ONE llm-ai → CODE → POST MARKET_STORE → Return
  MARKET_STORE    webhook store: secret → GET reports → CODE re-check + decide → router (refuse / new POST / re-run PATCH) → CODE → news → [BROADCAST] → [job] → Return
  BROADCAST       webhook send | retry: secret → Queued delivery per recipient → only if queued: template → PATCH → MARKET_PUBLISH → Return
  MARKET_PUBLISH  webhook publish: secret → GET reports + deliveries → CODE → [report Sent + counts, reader copy] → [job] → Return
A loop over a 0-or-1 list stands in for "only if" where a second router would sit inside the first (no router in a router).
Connections and Studio ids are never invented: SET_IN_STUDIO_* placeholders, listed by each CHECKLIST.
"""
import argparse, copy, json, os, re, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SK = os.environ.get("PUCHO_OS") or json.load(open(os.path.join(ROOT, "docs", ".pucho-os.json")))["skill_path"]
FLOW_DIR = os.path.join(SK, "flow")
sys.path.insert(0, FLOW_DIR)
from flowkit import step, code, router, chain, respond, constants, piece_trigger, webhook_trigger, llm, flow, lib_code, inline_lib, TEXT_IS  # noqa: E402
import studio_checklist  # noqa: E402

LIB_DIR = os.path.join(ROOT, "app", "src", "custom", "lib")
WF = os.path.join(ROOT, "workflows")
C = "step_constants"
APP = "{{step_constants['app_url']}}"
# Owner decision 15 Oct 2026: the five source names stay; the three dead publisher feeds (ET's URL serves an HTML page,
# Moneycontrol's top-news feed is frozen in 2016, feeds.reuters.com no longer resolves — S4) are read through Google News
# RSS search scoped to the publisher, the same shape as the two Google feeds that work. Each URL is one constant (feeds.*).
GN = "https://news.google.com/rss/search?q="
FEEDS = {
    "et": GN + "site:economictimes.indiatimes.com+markets+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "mc": GN + "site:moneycontrol.com+markets+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "reuters": GN + "site:reuters.com+India+markets+when:1d&hl=en-IN&gl=IN&ceid=IN:en",
    "gfn": GN + "India+stock+market+Nifty+Sensex&hl=en-IN&gl=IN&ceid=IN:en",
    "global": GN + "SGX+Nifty+US+markets+Dow+Jones+NASDAQ+when:1d&hl=en&gl=US&ceid=US:en",
}
FEED_NAMES = {"et": "Economic Times Markets", "mc": "Moneycontrol", "reuters": "Reuters India", "gfn": "Google Finance News", "global": "Global Market Cues"}

def lib_cols(name):
    """A column list exported by market.js (one source of truth for what a write names)."""
    src = open(os.path.join(LIB_DIR, "market.js"), encoding="utf-8").read()
    m = re.search(r"export const " + name + r" = \[([\s\S]*?)\];", src)
    return re.findall(r"'([A-Za-z_0-9]+)'", m.group(1))
REPORT_COLS = lib_cols("REPORT_WRITE_COLUMNS")
PUBLISHED_COLS = lib_cols("PUBLISHED_COLUMNS")

# ── small emitters (the kit's idioms: named fields under body.data, uppercase NONE, the app door with its token) ──
def hdr(read=False):
    h = {"Authorization": "Bearer {{step_constants['inbound_token']}}", "X-Flow": "{{step_constants['flow']}}"}
    return {"Accept": "application/json", **h} if read else {"Content-Type": "application/json", **h}
def http(n, method, url, disp, body=None, query=None, headers=None, retry=False, cont=False):
    inp = {"method": method, "url": url, "headers": headers if headers is not None else hdr(method == "GET"), "queryParams": query or {}, "authType": "NONE"}
    if body is not None: inp.update({"body_type": "json", "body": {"data": body}})
    return step(n, "http", "send_request", inp, disp, retry=retry, cont=cont)
def read(n, entity, disp):
    return http(n, "GET", f"{APP}/api/data/{entity}", disp, query={"select": "*"}, retry=True, cont=True)
def secret_key(webhook_key): return webhook_key.replace("_webhook", "_secret")
def hook(n, const_key, body, disp, retry=True, cont=False):
    """POST to another Studio flow's webhook — the bare URL (those flows answer at once and run on) with ?k=<that flow's secret>."""
    return http(n, "POST", "{{step_constants['" + const_key + "']}}", disp, body=body, headers={"Content-Type": "application/json"},
                query={"k": "{{step_constants['" + secret_key(const_key) + "']}}"}, retry=retry, cont=cont)
def callee(*flows):
    """The constants a caller needs for each flow it calls: the bare webhook URL and that flow's secret (pasted in Studio)."""
    out = {}
    for f in flows:
        out[f.lower() + "_webhook"] = f"SET_IN_STUDIO_{f}_WEBHOOK_URL"; out[f.lower() + "_secret"] = f"SET_IN_STUDIO_{f}_WEBHOOK_SECRET"
    return out
def named(ref, cols, extra=None):
    d = {c: "{{" + ref + "['" + c + "']}}" for c in cols}
    d.update(extra or {}); return d
def lib(n, fn, inputs, disp):
    return code(n, lib_code(f"return {fn}(inputs);"), inputs, disp)
def loop(n, items, disp, *body):
    """LOOP_ON_ITEMS (resolved 7 Oct 2026, workflow-rules § 1.20): settings.items, inner steps off firstLoopAction, item at {{n['item']}}."""
    return {"name": n, "type": "LOOP_ON_ITEMS", "displayName": disp, "valid": True, "skip": False,
            "settings": {"items": items, "sampleData": {}}, "firstLoopAction": chain(*body), "nextAction": None}
def ret(n, body, disp, status=200):
    return respond(n, body, disp, status=status)
def whatsapp(n, ref, disp):
    """pucho-whatsapp approved template (S5): account from constants (a Studio dropdown value), number, template id + variables from the plan."""
    return step(n, "pucho-whatsapp", "send_template_message",
                {"account_id": "{{step_constants['whatsapp_account_id']}}", "to": "{{" + ref + "['to']}}", "template_id": "{{" + ref + "['template_id']}}",
                 "template_variables": "{{" + ref + "['template_variables']}}"}, disp, retry=False, cont=True)
def app_consts(name, extra):
    return constants(C, {"flow": name, "app_url": "SET_IN_STUDIO_APP_URL", "inbound_token": "SET_IN_STUDIO_INBOUND_TOKEN", **extra},
                     "Constants — app_url, inbound_token and the flow's settings (set in Studio)")
def auth_consts(name, extra, actions, app=True):
    """The FIRST step of every webhook flow (SA-01..SA-04): the constants AND the webhook secret check. The caller's ?k= is compared in
    constant time with this flow's own `webhook_secret` (fail closed on a placeholder); `gate` is denied | bad_action | ok and the next
    router answers 401 / 400 before any read, fetch, AI step, send or write. The own secret is not passed on to later steps.
    UNVERIFIED: that Studio's catch_webhook exposes the query string as {{trigger['queryParams']}} (Activepieces' shape; no golden export shows it)."""
    vals = {"flow": name, **({"app_url": "SET_IN_STUDIO_APP_URL", "inbound_token": "SET_IN_STUDIO_INBOUND_TOKEN"} if app else {}),
            "webhook_secret": f"SET_IN_STUDIO_{name}_WEBHOOK_SECRET", **extra}
    body = json.dumps(vals, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    src = ("// @ts-nocheck\n// lib: secretMatches — app/src/custom/lib/market.js (constant-time, fail closed)\n" + lib_chunks()["secretMatches"] + "\n// end lib\n"
           "export const code = async (inputs) => {\n  const C = " + body + ";\n"
           f"  const actions = {json.dumps(actions)};\n"
           "  const gate = !secretMatches(inputs.k, C.webhook_secret) ? 'denied' : actions.includes(String(inputs.action || '')) ? 'ok' : 'bad_action';\n"
           "  const { webhook_secret, ...rest } = C;\n  return { ...rest, gate };\n};")
    return code(C, src, {"k": "{{trigger['queryParams']['k']}}", "action": "{{trigger['body']['action']}}"}, "Constants + webhook secret check (first step)")
def denied(): return ret("step_denied_done", {"ok": False, "error": "unauthorized"}, "Return 401: missing or wrong webhook secret, or no gate", status=401)
def bad_action(): return ret("step_bad_action_done", {"ok": False, "error": "unknown action"}, "Return 400: unknown action", status=400)
def GATE(v): return {**TEXT_IS("{{step_constants['gate']}}", v), "caseSensitive": True}
def auth_router(with_action=False):
    """Router A, an ALLOW-LIST (SA-21): only gate = 'ok' (exact) continues — its branch is empty and the flow carries on after the
    router; gate = 'bad_action' answers 400; every other value, a missing gate included (a skipped or re-pasted first step), falls
    to the FALLBACK, which answers 401 and stops."""
    br = [("Authorised", GATE("ok"), None)]
    if with_action: br.append(("Unknown action → 400", GATE("bad_action"), bad_action()))
    return router("step_auth", "Webhook secret · action (allow-list)", br + [("Anything else → 401", None, denied())])
def job_post(n, loop_name, disp):
    return http(n, "POST", f"{APP}/api/jobs/" + "{{" + loop_name + "['item']['id']}}", disp,
                body={"status": "{{" + loop_name + "['item']['status']}}", "result": "{{" + loop_name + "['item']['result']}}"}, retry=True, cont=True)

# ── the flows ──
HOLIDAYS_NOTE = "Constants — holidays (NSE trading holidays, ⚑ G3: the SAME list in DAILY_SCHEDULE and DAILY_WATCHDOG)"
def daily_schedule():
    t = piece_trigger("schedule", "every_day", {"hour_of_the_day": "6", "timezone": "Asia/Kolkata", "run_on_weekends": False}, "Every weekday at 06:00 IST (fixes S1)")
    k = constants(C, {"flow": "DAILY_SCHEDULE", "holidays": [], **callee("MARKET_REPORT")}, HOLIDAYS_NOTE + " and MARKET_REPORT's URL + secret")
    g = lib("step_gate", "scheduleGate", {"C": "{{step_constants}}"}, "Weekday and not an NSE holiday? (CODE)")
    r = router("step_router", "Run today?", [
        ("Holiday or weekend — no run", TEXT_IS("{{step_gate['route']}}", "skip"),
         ret("step_skip_done", {"ok": True, "queued": False, "date": "{{step_gate['today']}}", "reason": "{{step_gate['reason']}}"}, "Return: skipped")),
        ("Run the report", None, chain(
            hook("step_run_post", "market_report_webhook", {"action": "run", "Trigger": "Schedule", "_who": "flow:DAILY_SCHEDULE"},
                 "POST MARKET_REPORT {action: run, Trigger: Schedule} ?k= — async, not /sync"),
            ret("step_run_done", {"ok": True, "queued": True, "date": "{{step_gate['today']}}"}, "Return: queued")))])
    chain(t, k, g, r)
    return flow("DAILY_SCHEDULE", "Market Intelligence — the 06:00 IST weekday trigger (holidays skipped) that starts MARKET_REPORT.run", t, ["schedule", "http", "webhook"])

def daily_watchdog():
    t = piece_trigger("schedule", "cron_expression", {"cronExpression": "20 6 * * 1-5", "timezone": "Asia/Kolkata"}, "Mon–Fri at 06:20 IST — the watchdog")
    k = constants(C, {"flow": "DAILY_WATCHDOG", "app_url": "SET_IN_STUDIO_APP_URL", "inbound_token": "SET_IN_STUDIO_INBOUND_TOKEN", "holidays": [], **callee("BROADCAST")},
                  HOLIDAYS_NOTE + ", app_url, inbound_token and BROADCAST's URL + secret")
    rd = read("step_read_reports", "reports", "GET reports (the app's door)")
    ck = lib("step_check", "watchdogCheck", {"C": "{{step_constants}}", "reports": "{{step_read_reports}}"}, "Today's report row there? (CODE)")
    r = router("step_router", "Alert?", [
        ("No report row — alert the admins", TEXT_IS("{{step_check['route']}}", "alert"), chain(
            hook("step_alert_post", "broadcast_webhook", {"action": "alert", "Report_ID": "", "_who": "flow:DAILY_WATCHDOG"},
                 "POST BROADCAST {action: alert} ?k= (BROADCAST writes the fixed watchdog text)"),
            ret("step_alert_done", {"ok": True, "alerted": True, "date": "{{step_check['today']}}", "reason": "{{step_check['reason']}}"}, "Return: alerted"))),
        ("Report row present", None,
         ret("step_ok_done", {"ok": True, "alerted": False, "date": "{{step_check['today']}}", "reason": "{{step_check['reason']}}"}, "Return: nothing to do"))])
    chain(t, k, rd, ck, r)
    return flow("DAILY_WATCHDOG", "Market Intelligence — 06:20 IST: no report row for today → the admins get the mi_run_failed alert", t, ["schedule", "http", "webhook"])

def market_report():
    """The app-facing door (WEBHOOK_MARKET_REPORT): secret, action, today's report state — all BEFORE a feed or the model is paid for (SA-02)."""
    t = webhook_trigger("Catch Webhook — MARKET_REPORT (run · rerun)")
    k = auth_consts("MARKET_REPORT", callee("MARKET_ANALYSE"), ["run", "rerun"])
    rd = read("step_read_reports", "reports", "GET reports (today's row, the re-run target)")
    g = lib("step_gate", "reportGate", {"body": "{{trigger['body']}}", "reports": "{{step_read_reports}}"}, "Run / re-run allowed today? (CODE)")
    jl = "step_refuse_job_loop"
    r = router("step_router", "Refuse or analyse", [
        ("Refuse (today's report exists / not Failed / app closed) → 409", TEXT_IS("{{step_gate['route']}}", "refuse"), chain(
            loop(jl, "{{step_gate['jobs']}}", "Report the app's job failed (0 or 1)", job_post("step_refuse_job", jl, "POST /api/jobs/<id> failed")),
            ret("step_refuse_done", {"ok": False, "code": "{{step_gate['code']}}", "error": "{{step_gate['error']}}"}, "Return 409: refused", status=409))),
        ("Analyse", None, chain(
            hook("step_analyse_post", "market_analyse_webhook", {"action": "{{step_gate['Mode']}}", "Trigger": "{{step_gate['Trigger']}}", "Report_ID": "{{step_gate['Report_ID']}}",
                                                              "_job": "{{step_gate['_job']}}", "_who": "flow:MARKET_REPORT"}, "POST MARKET_ANALYSE ?k= — the feeds and the model"),
            ret("step_analyse_done", {"ok": True, "queued": True, "action": "{{step_gate['Mode']}}"}, "Return 202: queued", status=202)))])
    chain(t, k, auth_router(with_action=True), rd, g, r)
    return flow("MARKET_REPORT", "Market Intelligence — the app's door for run / rerun: webhook secret, action and today's report checked before any paid step", t, ["webhook", "http"])

def market_analyse():
    t = webhook_trigger("Catch Webhook — MARKET_ANALYSE (from MARKET_REPORT)")
    k = auth_consts("MARKET_ANALYSE", {"news_limit": 40, "summary_chars": 300, "dedupe_chars": 60, "max_age_hours": 48, "feeds": FEEDS, **callee("MARKET_STORE")},
                    ["run", "rerun"], app=False)
    fetches = [http(f"step_fetch_{key}", "GET", "{{step_constants['feeds']['" + key + "']}}", f"Fetch {FEED_NAMES[key]} RSS (a failure yields 0 items)",
                    headers={"Accept": "application/rss+xml, application/xml, text/xml", "User-Agent": "Mozilla/5.0 (compatible; MarketIntelligence/1.0)"}, cont=True)
               for key in FEEDS]
    prep = lib("step_prep", "prepNews", {"body": "{{trigger['body']}}", "C": "{{step_constants}}", **{key: "{{step_fetch_" + key + "}}" for key in FEEDS}},
               "Parse · dedupe · categorise · impact · keep 40 · prompt (CODE — fixes S2, S3)")
    def store_post(n, report_ref, disp):
        return hook(n, "market_store_webhook", {"action": "store", "Mode": "{{step_prep['Mode']}}", "Trigger": "{{step_prep['Trigger']}}", "Report_ID": "{{step_prep['Report_ID']}}",
                                                "_job": "{{step_prep['_job']}}", "_who": "flow:MARKET_ANALYSE", "report": report_ref, "articles": "{{step_prep['articles']}}"}, disp)
    ai = llm("step_ai", "{{step_prep['prompt']}}", "Ask LLM — the pre-market commentary as JSON (standard, 0.3, 2,000 tokens)", model="standard", temp=0.3, tokens="2000")
    ai["settings"]["errorHandlingOptions"]["continueOnFailure"]["value"] = True   # a model failure becomes a Failed row + the admin alert
    r = router("step_router", "No news? · analyse", [
        ("No news → Failed row", TEXT_IS("{{step_prep['route']}}", "failed"), chain(
            store_post("step_nonews_store", "{{step_prep['failed_report']}}", "POST MARKET_STORE ?k= — Failed (no news)"),
            ret("step_nonews_done", {"ok": True, "Status": "Failed", "Report_Date": "{{step_prep['Report_Date']}}", "Source_Status": "{{step_prep['Source_Status']}}"}, "Return: no news"))),
        ("Analyse", TEXT_IS("{{step_prep['route']}}", "analyse"), chain(
            ai, lib("step_finish", "finishReport", {"ai": "{{step_ai}}", "prep": "{{step_prep}}"}, "Parse + check the model JSON · format WhatsApp (CODE)"),
            store_post("step_store", "{{step_finish['report']}}", "POST MARKET_STORE ?k= — the finished report"),
            ret("step_done", {"ok": True, "action": "{{step_prep['Mode']}}", "Report_Date": "{{step_prep['Report_Date']}}", "Status": "{{step_finish['Status']}}",
                              "Articles_Analyzed": "{{step_prep['Articles_Analyzed']}}"}, "Return: handed to MARKET_STORE"))),
        ("Invalid", None, ret("step_invalid_done", {"ok": False, "error": "{{step_prep['error']}}"}, "Return 400: invalid", status=400))])
    chain(t, k, auth_router(with_action=True), *fetches, prep, r)
    return flow("MARKET_ANALYSE", "Market Intelligence — five RSS feeds → one llm-ai commentary call → the finished row to MARKET_STORE", t, ["webhook", "http", "llm-ai"])

def market_store():
    t = webhook_trigger("Catch Webhook — MARKET_STORE (from MARKET_ANALYSE)")
    k = auth_consts("MARKET_STORE", {"auto_send": True, **callee("BROADCAST")}, ["store"])
    rd = read("step_read_reports", "reports", "GET reports (today's row, the re-run target)")
    plan = lib("step_plan", "storePlan", {"body": "{{trigger['body']}}", "reports": "{{step_read_reports}}"}, "New, re-run or refuse? Every text field re-checked (CODE)")
    patch_cols = [c for c in REPORT_COLS if c not in ("Created_At",)]
    def tail(prefix, write, label):
        after = lib(f"step_{prefix}_after", "afterWrite", {"written": "{{step_" + prefix + "_" + write + "}}", "plan": "{{step_plan}}", "C": "{{step_constants}}", "body": "{{trigger['body']}}"},
                    "Read the write: Report_ID · news ids · hand-offs (CODE)")
        news = http(f"step_{prefix}_news", "POST", f"{APP}/api/data/news_articles", "POST news_articles (ids: Report_ID + dedupe key — a re-run never doubles them)",
                    body="{{step_" + prefix + "_after['news']}}", retry=True, cont=True)
        bcl = f"step_{prefix}_bc_loop"
        bc = loop(bcl, "{{step_" + prefix + "_after['broadcasts']}}", "Hand to BROADCAST (0 or 1: Failed → admin alert · Ready → only when auto_send)",
                  hook(f"step_{prefix}_bc", "broadcast_webhook", {"action": "{{" + bcl + "['item']['action']}}", "Report_ID": "{{" + bcl + "['item']['Report_ID']}}",
                                                               "_who": "flow:MARKET_STORE"}, "POST BROADCAST {action: send | alert} ?k=", cont=True))
        jl = f"step_{prefix}_job_loop"
        jb = loop(jl, "{{step_" + prefix + "_after['jobs']}}", "Report the app's job (0 or 1 — a scheduled run has none)", job_post(f"step_{prefix}_job", jl, "POST /api/jobs/<id> done | failed"))
        dn = ret(f"step_{prefix}_done", {"ok": "{{step_" + prefix + "_after['ok']}}", "Report_ID": "{{step_" + prefix + "_after['Report_ID']}}", "Status": "{{step_" + prefix + "_after['Status']}}",
                                         "error": "{{step_" + prefix + "_after['error']}}"}, f"Return: {label}")
        return after, news, bc, jb, dn
    ins = http("step_new_insert", "POST", f"{APP}/api/data/reports", "POST reports — today's report (Report_ID numbered by the app; 409 = today's exists)",
               body=named("step_plan['row']", REPORT_COLS, {"Report_ID": ""}), cont=True)
    upd = http("step_rerun_update", "PATCH", f"{APP}/api/data/reports", "PATCH reports — re-run a Failed report (Failed → Ready, or Failed with the new error)",
               body=named("step_plan['row']", patch_cols), query={"Report_ID": "eq.{{step_plan['Report_ID']}}"}, cont=True)
    jl = "step_refuse_job_loop"
    r = router("step_router", "Refuse · new · re-run", [
        ("Refuse (exists / Sent / not Failed / app closed)", TEXT_IS("{{step_plan['route']}}", "refuse"), chain(
            loop(jl, "{{step_plan['jobs']}}", "Report the app's job failed (0 or 1)", job_post("step_refuse_job", jl, "POST /api/jobs/<id> failed")),
            ret("step_refuse_done", {"ok": False, "code": "{{step_plan['code']}}", "error": "{{step_plan['error']}}"}, "Return 409: refused", status=409))),
        ("New report (POST)", TEXT_IS("{{step_plan['route']}}", "new"), chain(ins, *tail("new", "insert", "new report stored"))),
        ("Re-run (PATCH)", TEXT_IS("{{step_plan['route']}}", "rerun"), chain(upd, *tail("rerun", "update", "re-run stored"))),
        ("Unexpected", None, ret("step_unexpected_done", {"ok": False, "error": "unexpected plan route"}, "Return 400: unexpected", status=400))])
    chain(t, k, auth_router(with_action=True), rd, plan, r)
    return flow("MARKET_STORE", "Market Intelligence — writes the finished report (one per Report_Date), its news, then hands it to BROADCAST", t, ["webhook", "http"])

def broadcast():
    t = webhook_trigger("Catch Webhook — BROADCAST (send · retry)")
    k = auth_consts("BROADCAST", {"whatsapp_account_id": "SET_IN_STUDIO_WHATSAPP_ACCOUNT_ID",
                                  "whatsapp_templates": {"report": "SET_IN_STUDIO_TEMPLATE_ID_MI_DAILY_REPORT", "alert": "SET_IN_STUDIO_TEMPLATE_ID_MI_RUN_FAILED"},
                                  "whatsapp_template_names": {"report": "mi_daily_report", "alert": "mi_run_failed"},
                                  "alert_to": "SET_IN_STUDIO_ADMIN_WHATSAPP_NUMBERS", "portal_url": "SET_IN_STUDIO_APP_URL", **callee("MARKET_PUBLISH")}, ["send", "retry", "alert"])
    sl, ql = "step_send_loop", "step_send_queued"
    send = chain(
        read("step_send_reports", "reports", "GET reports"),
        read("step_send_subscribers", "subscribers", "GET subscribers"),
        lib("step_send_plan", "sendPlan", {"body": "{{trigger['body']}}", "C": "{{step_constants}}", "reports": "{{step_send_reports}}", "subscribers": "{{step_send_subscribers}}"},
            "Who gets what: today's Ready report → eligible subscribers · Failed / Alert → admins (CODE)"),
        loop(sl, "{{step_send_plan['items']}}", "For each recipient",
             http("step_send_queue", "POST", f"{APP}/api/data/deliveries", "POST deliveries — Queued, Attempts 1 (409 = already sent)",
                  body=named(sl + "['item']['delivery']", ["Kind", "Report_ID", "Report_Date", "Subscriber_ID", "Subscriber_Name", "Sentiment", "Status"], {"Delivery_ID": "", "Attempts": 1}), cont=True),
             loop(ql, "{{step_send_queue['body']}}", "Only if queued (0 or 1: a 409 skips — no WhatsApp, no PATCH)",
                  whatsapp("step_send_whatsapp", sl + "['item']", "Send WhatsApp template (mi_daily_report · mi_run_failed)"),
                  lib("step_send_result", "sendResult", {"Delivery_ID": "{{" + ql + "['item']['Delivery_ID']}}", "sent": "{{step_send_whatsapp}}"}, "Sent or Failed? (CODE)"),
                  http("step_send_update", "PATCH", f"{APP}/api/data/deliveries", "PATCH the delivery Sent (message id) or Failed (error)",
                       body=named("step_send_result", ["Status", "Message_ID", "Error_Message", "Sent_At"]), query={"Delivery_ID": "eq.{{step_send_result['Delivery_ID']}}"}, retry=True, cont=True))),
        hook("step_send_publish", "market_publish_webhook", {"action": "publish", "Report_ID": "{{step_send_plan['publish']['Report_ID']}}",
                                                          "_job": "{{step_send_plan['publish']['_job']}}", "_who": "flow:BROADCAST"}, "POST MARKET_PUBLISH ?k= — counts, reader copy, job", cont=True),
        ret("step_send_done", {"ok": True, "kind": "{{step_send_plan['kind']}}", "Report_ID": "{{step_send_plan['Report_ID']}}", "queued": "{{step_send_plan['queued']}}",
                               "reason": "{{step_send_plan['reason']}}"}, "Return: handed to WhatsApp"))
    cl = "step_retry_claimed"
    retry = chain(
        read("step_retry_deliveries", "deliveries", "GET deliveries"),
        read("step_retry_subscribers", "subscribers", "GET subscribers"),
        read("step_retry_reports", "reports", "GET reports"),
        lib("step_retry_plan", "retryPlan", {"body": "{{trigger['body']}}", "C": "{{step_constants}}", "deliveries": "{{step_retry_deliveries}}",
                                             "subscribers": "{{step_retry_subscribers}}", "reports": "{{step_retry_reports}}"}, "Failed report delivery, < 3 attempts, Active + opted-in? (CODE)"),
        http("step_retry_claim", "PATCH", f"{APP}/api/data/deliveries", "PATCH Attempts + 1, only where Attempts = the value read (a refusal has no id → the app refuses)",
             body={"Attempts": "{{step_retry_plan['claim']['Attempts']}}"}, query={"Delivery_ID": "eq.{{step_retry_plan['claim']['Delivery_ID']}}", "Attempts": "{{step_retry_plan['claim']['expect']}}"}, cont=True),
        loop(cl, "{{step_retry_claim['body']}}", "Only if claimed (0 or 1)",
             whatsapp("step_retry_whatsapp", "step_retry_plan['send']", "Send WhatsApp template mi_daily_report to the number on the subscriber record"),
             lib("step_retry_result", "sendResult", {"Delivery_ID": "{{" + cl + "['item']['Delivery_ID']}}", "sent": "{{step_retry_whatsapp}}"}, "Sent or Failed? (CODE)"),
             http("step_retry_update", "PATCH", f"{APP}/api/data/deliveries", "PATCH the same delivery Sent or Failed",
                  body=named("step_retry_result", ["Status", "Message_ID", "Error_Message", "Sent_At"]), query={"Delivery_ID": "eq.{{step_retry_result['Delivery_ID']}}"}, retry=True, cont=True),
             hook("step_retry_publish", "market_publish_webhook", {"action": "publish", "Report_ID": "{{step_retry_plan['publish']['Report_ID']}}", "_job": "", "_who": "flow:BROADCAST"},
                  "POST MARKET_PUBLISH ?k= — refresh the report's counts", cont=True),
             ret("step_retry_sent", {"ok": True, "sent": "{{step_retry_result['sent']}}", "Delivery_ID": "{{step_retry_result['Delivery_ID']}}",
                                     "error": "{{step_retry_result['Error_Message']}}"}, "Return: the retry's outcome")),
        ret("step_retry_done", {"ok": False, "sent": False, "Delivery_ID": "{{step_retry_plan['Delivery_ID']}}", "error": "{{step_retry_plan['reason']}}"}, "Return: refused (nothing sent)"))
    ACT = lambda v: {**TEXT_IS("{{trigger['body']['action']}}", v), "caseSensitive": True}
    r = router("step_router", "Webhook secret · send | alert · retry (allow-list)", [
        ("send | alert", [GATE("ok"), ACT("send")], send),
        ("retry", [GATE("ok"), ACT("retry")], retry),
        ("Unknown action → 400", GATE("bad_action"), bad_action()),
        ("Anything else → 401", None, denied())])
    r["settings"]["branches"][0]["conditions"].append([GATE("ok"), ACT("alert")])   # OR: the flow-only alert action takes the same path
    chain(t, k, r)
    return flow("BROADCAST", "Market Intelligence — the report to every Active, opted-in subscriber (template), the admin alert, one delivery again", t, ["webhook", "http", "pucho-whatsapp"])

def market_publish():
    t = webhook_trigger("Catch Webhook — MARKET_PUBLISH (from BROADCAST)")
    k = auth_consts("MARKET_PUBLISH", {}, ["publish"])
    pl, jl = "step_pub_loop", "step_job_loop"
    chain(t, k, auth_router(with_action=True),
          read("step_read_reports", "reports", "GET reports"),
          read("step_read_deliveries", "deliveries", "GET deliveries"),
          lib("step_plan", "publishPlan", {"body": "{{trigger['body']}}", "reports": "{{step_read_reports}}", "deliveries": "{{step_read_deliveries}}"},
              "Counts · reader copy — only when something was sent (CODE)"),
          loop(pl, "{{step_plan['pub']}}", "Publish (0 or 1 — a Ready / Sent report with at least one Sent delivery)",
               http("step_report_update", "PATCH", f"{APP}/api/data/reports", "PATCH the report Sent · Sent_At · Sent_Count · Failed_Count",
                    body=named(pl + "['item']['patch']", ["Status", "Sent_At", "Sent_Count", "Failed_Count"]), query={"Report_ID": "eq.{{" + pl + "['item']['Report_ID']}}"}, retry=True, cont=True),
               http("step_published_insert", "POST", f"{APP}/api/data/published_reports", "UPSERT published_reports, 1 of 2: POST (409 = already published)",
                    body=named(pl + "['item']['published']", ["Report_ID", "Published_At"] + PUBLISHED_COLS), cont=True),
               http("step_published_update", "PATCH", f"{APP}/api/data/published_reports", "UPSERT published_reports, 2 of 2: PATCH (the corrected copy after an edit)",
                    body=named(pl + "['item']['published']", ["Published_At"] + PUBLISHED_COLS), query={"Report_ID": "eq.{{" + pl + "['item']['Report_ID']}}"}, retry=True, cont=True)),
          loop(jl, "{{step_plan['jobs']}}", "Report the app's job (0 or 1)", job_post("step_job", jl, "POST /api/jobs/<id> done | failed")),
          ret("step_done", {"ok": "{{step_plan['ok']}}", "Report_ID": "{{step_plan['Report_ID']}}", "sent": "{{step_plan['Sent_Count']}}", "failed": "{{step_plan['Failed_Count']}}",
                            "note": "{{step_plan['reason']}}"}, "Return: published"))
    return flow("MARKET_PUBLISH", "Market Intelligence — after a broadcast: report Sent with its counts, the subscriber copy, the app's job", t, ["webhook", "http"])

WIRING = """
## Wiring the seven Market Intelligence flows (all of them — do this once)
- Import in this order, publishing each and copying its webhook URL: MARKET_PUBLISH → BROADCAST → MARKET_STORE → MARKET_ANALYSE → MARKET_REPORT → DAILY_WATCHDOG → DAILY_SCHEDULE.
- **Webhook secrets (SA-01..SA-04).** Generate one random secret per webhook flow (≥ 32 characters, e.g. `openssl rand -hex 24`): MARKET_REPORT, MARKET_ANALYSE,
  MARKET_STORE, BROADCAST, MARKET_PUBLISH. Paste each into that flow's own `webhook_secret` constant AND into the `<flow>_secret` constant of every flow that
  calls it. A missing or wrong `?k=` answers 401 before anything is read, fetched, sent or written; a placeholder secret refuses everyone.
- Paste each URL **bare** (never `/sync` — every flow-to-flow hop is async) into the `<flow>_webhook` constant that names it; the `?k=` is added by the step.
- The app calls two of them, with the secret in the URL: `WEBHOOK_MARKET_REPORT=<MARKET_REPORT url>?k=<MARKET_REPORT secret>` (run, rerun are async) and
  `WEBHOOK_BROADCAST=<BROADCAST url>/sync?k=<BROADCAST secret>` (retry waits for its Return; send is async, so the app posts and does not wait).
  UNVERIFIED: that a long send started through /sync keeps running after Studio's sync window closes — if not, split send onto its own bare-URL flow.
- `holidays` (NSE trading holidays, ⚑ G3): fill the SAME list in DAILY_SCHEDULE and DAILY_WATCHDOG.
- Give each flow its own token: `INBOUND_TOKEN_<FLOW>` on the app, the same value in that flow's `inbound_token`. While the app's token is unset every read answers 403 and the flows say APP_CLOSED.
- UNVERIFIED until the first import: `{{trigger['queryParams']['k']}}` (the query string on catch_webhook), LOOP_ON_ITEMS (also nested), `body.data` in the JSON Body box,
  pucho-whatsapp's response and `template_variables` keys (mi_daily_report: date, sentiment, confidence, driver · mi_run_failed: error, date, time),
  `return_response` at the end of a schedule-triggered flow, and the app honouring `?Attempts=eq.<n>` on PATCH (kernel ticket: today the door filters on the id only).
"""

BUILDERS = [daily_schedule, daily_watchdog, market_report, market_analyse, market_store, broadcast, market_publish]

# ── the contracts: written here, by hand, as the outcomes each flow must perform (stricter than the generic one) ──
F = lambda *names: [f"fetch_{n}=step_fetch_{n}:http:read" for n in names]
AUTH = ["auth_gate=step_constants:code:transform", "answer_unauthorized=step_denied_done:webhook:respond", "answer_bad_action=step_bad_action_done:webhook:respond"]
AUTH_ROUTER = ["auth_route=step_auth:router:route"]
CONTRACTS = {
    "DAILY_SCHEDULE": ["schedule=trigger:schedule:trigger", "gate=step_gate:code:transform", "route=step_router:router:route",
                       "start_report=step_run_post:http:write", "answer_run=step_run_done:webhook:respond", "answer_skip=step_skip_done:webhook:respond"],
    "DAILY_WATCHDOG": ["schedule=trigger:schedule:trigger", "read_reports=step_read_reports:http:read", "check=step_check:code:transform", "route=step_router:router:route",
                       "alert=step_alert_post:http:write", "answer_alert=step_alert_done:webhook:respond", "answer_ok=step_ok_done:webhook:respond"],
    "MARKET_REPORT": ["webhook=trigger:webhook:trigger", *AUTH, *AUTH_ROUTER, "read_reports=step_read_reports:http:read", "gate=step_gate:code:transform",
                      "route=step_router:router:route", "refuse_job=step_refuse_job:http:write", "answer_refused=step_refuse_done:webhook:respond",
                      "start_analysis=step_analyse_post:http:write", "answer_queued=step_analyse_done:webhook:respond"],
    "MARKET_ANALYSE": ["webhook=trigger:webhook:trigger", *AUTH, *AUTH_ROUTER, *F(*FEEDS), "prep=step_prep:code:transform", "route=step_router:router:route",
                       "model=step_ai:llm-ai:read", "finish=step_finish:code:transform", "store=step_store:http:write", "answer=step_done:webhook:respond",
                       "store_failed=step_nonews_store:http:write", "answer_failed=step_nonews_done:webhook:respond", "answer_invalid=step_invalid_done:webhook:respond"],
    "MARKET_STORE": ["webhook=trigger:webhook:trigger", *AUTH, *AUTH_ROUTER, "read_reports=step_read_reports:http:read", "plan=step_plan:code:transform", "route=step_router:router:route",
                     "refuse_job=step_refuse_job:http:write", "answer_refuse=step_refuse_done:webhook:respond",
                     "insert_report=step_new_insert:http:write", "after_new=step_new_after:code:transform", "news_new=step_new_news:http:write", "broadcast_new=step_new_bc:http:write",
                     "job_new=step_new_job:http:write", "answer_new=step_new_done:webhook:respond",
                     "patch_report=step_rerun_update:http:write", "after_rerun=step_rerun_after:code:transform", "news_rerun=step_rerun_news:http:write", "broadcast_rerun=step_rerun_bc:http:write",
                     "job_rerun=step_rerun_job:http:write", "answer_rerun=step_rerun_done:webhook:respond", "answer_unexpected=step_unexpected_done:webhook:respond"],
    "BROADCAST": ["webhook=trigger:webhook:trigger", *AUTH, "route=step_router:router:route",
                  "read_reports=step_send_reports:http:read", "read_subscribers=step_send_subscribers:http:read", "plan=step_send_plan:code:transform",
                  "queue=step_send_queue:http:write", "send=step_send_whatsapp:pucho-whatsapp:write", "result=step_send_result:code:transform",
                  "delivery_update=step_send_update:http:write", "publish=step_send_publish:http:write", "answer_send=step_send_done:webhook:respond",
                  "retry_read_deliveries=step_retry_deliveries:http:read", "retry_read_subscribers=step_retry_subscribers:http:read", "retry_read_reports=step_retry_reports:http:read",
                  "retry_plan=step_retry_plan:code:transform", "retry_claim=step_retry_claim:http:write", "retry_send=step_retry_whatsapp:pucho-whatsapp:write",
                  "retry_result=step_retry_result:code:transform", "retry_update=step_retry_update:http:write", "retry_publish=step_retry_publish:http:write",
                  "answer_retry_sent=step_retry_sent:webhook:respond", "answer_retry_refused=step_retry_done:webhook:respond"],
    "MARKET_PUBLISH": ["webhook=trigger:webhook:trigger", *AUTH, *AUTH_ROUTER, "read_reports=step_read_reports:http:read", "read_deliveries=step_read_deliveries:http:read",
                       "plan=step_plan:code:transform", "report_sent=step_report_update:http:write", "published_insert=step_published_insert:http:write",
                       "published_update=step_published_update:http:write", "job=step_job:http:write", "answer=step_done:webhook:respond"],
}
# One test payload per action — the CHECKLIST shows them (send each to the webhook URL with ?k=<that flow's secret>), tests/flow_sim.test.mjs runs them.
SAMPLES = {
    "DAILY_SCHEDULE": [],
    "DAILY_WATCHDOG": [],
    "MARKET_REPORT": [("run — today's report (Run report now, DAILY_SCHEDULE) · URL ?k=<secret>", {"action": "run", "Trigger": "Manual", "_who": "Test"}),
                      ("rerun — today's Failed report · URL ?k=<secret>", {"action": "rerun", "Report_ID": "MIR-2026-0099", "_who": "Test"})],
    "MARKET_ANALYSE": [("run — sent by MARKET_REPORT (test MARKET_REPORT instead) · URL ?k=<secret>", {"action": "run", "Trigger": "Manual", "Report_ID": "", "_job": ""})],
    "MARKET_STORE": [("store — sent by MARKET_ANALYSE (shape only; test MARKET_REPORT instead) · URL ?k=<secret>", {"action": "store", "Mode": "run", "Trigger": "Manual", "Report_ID": "", "_job": "",
                      "report": {"Report_Date": "2026-10-15", "Status": "Failed", "Error_Message": "Studio test — no analysis", "Source_Status": "test"}, "articles": []})],
    "BROADCAST": [("send — today's Ready report to every Active, opted-in subscriber · URL ?k=<secret>", {"action": "send", "Report_ID": "MIR-2026-0101"}),
                  ("alert — the admin alert (flows only: the watchdog, MARKET_STORE for a Failed report) · URL ?k=<secret>", {"action": "alert", "Report_ID": ""}),
                  ("retry — one Failed delivery · URL ?k=<secret>", {"action": "retry", "Delivery_ID": "DLV-2026-2402"})],
    "MARKET_PUBLISH": [("publish — sent by BROADCAST after a send · URL ?k=<secret>", {"action": "publish", "Report_ID": "MIR-2026-0101", "_job": ""})],
}

# ── the library in each CODE node: flowkit.inline_lib when rolldown is there, else the same reachability shake done here ──
DECL = re.compile(r"^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)", re.M)
def lib_chunks():
    chunks = {}
    for f in ("market.js", "market-flow.js"):
        src = open(os.path.join(LIB_DIR, f), encoding="utf-8").read()
        src = re.sub(r"^import\s[\s\S]*?from\s+'[^']+';\s*$", "", src, flags=re.M)
        starts = [m.start() for m in DECL.finditer(src)] + [len(src)]
        for a, b in zip(starts, starts[1:]):
            body = src[a:b].rstrip()
            name = DECL.match(body).group(1)
            body = re.sub(r"^export\s+", "", body)
            body = re.sub(r"\n(?:\s*//[^\n]*|\s*/\*\*[\s\S]*?\*/)\s*$", "", body).rstrip()   # a comment that belongs to the next declaration
            if name in chunks: raise SystemExit(f"`{name}` is declared twice in the library")
            chunks[name] = body
    return chunks
def shake(fn, chunks):
    keep, todo = [], [fn]
    while todo:
        n = todo.pop()
        if n in keep: continue
        keep.append(n)
        for other in chunks:
            # `...X` is a spread, not a property access: blank the dots before the look-behind that skips `obj.X`
            if other not in keep and re.search(r"(?<![\w$.])" + re.escape(other) + r"(?![\w$])", chunks[n].replace("...", "   ")): todo.append(other)
    order = list(chunks)
    return "\n".join(chunks[n] for n in sorted(keep, key=order.index))
def fill_lib(flows):
    import flowkit
    if os.path.isdir(os.path.join(ROOT, "app", "node_modules", "rolldown")):
        inline_lib(flows, LIB_DIR, os.path.join(ROOT, "app")); return "flowkit.inline_lib (rolldown)"
    chunks = lib_chunks(); jobs = {j["id"]: j for j in flowkit._LIB_JOBS}
    def fill(node):
        if isinstance(node, dict):
            sc = (node.get("settings") or {}).get("sourceCode")
            if sc and "__LIB_NODE_" in sc["code"]:
                j = jobs[re.search(r"__LIB_NODE_(n\d+)__", sc["code"]).group(1)]; fn = re.search(r"return (\w+)\(inputs\)", j["body"]).group(1)
                sc["code"] = ("// @ts-nocheck\n// lib: app/src/custom/lib/market.js + market-flow.js — only what " + fn + "() reaches (tools/build_market_flows.py)\n"
                              + shake(fn, chunks) + "\n// end lib\nexport const code = async (inputs) => {\n  " + j["body"] + "\n};")
            for v in node.values(): fill(v)
        elif isinstance(node, list):
            for v in node: fill(v)
    for f in flows: fill(f)
    flowkit._LIB_JOBS.clear()
    if "__LIB_NODE_" in json.dumps(flows): raise SystemExit("a lib_code() placeholder was not filled")
    return "reachability shake in tools/build_market_flows.py (rolldown is not in app/node_modules)"

def strip_null(node):
    """Studio exports carry no `nextAction` on a leaf — inside routers and loops too."""
    if not isinstance(node, dict): return
    for c in node.get("children") or []: strip_null(c)
    if node.get("firstLoopAction"): strip_null(node["firstLoopAction"])
    if node.get("nextAction") is None: node.pop("nextAction", None)
    else: strip_null(node["nextAction"])
def names_of(fl):
    out = set()
    def walk(n):
        if not isinstance(n, dict): return
        s = n.get("settings") or {}
        if s.get("actionName") or s.get("triggerName"): out.add(s.get("actionName") or s.get("triggerName"))
        for c in n.get("children") or []: walk(c)
        walk(n.get("firstLoopAction")); walk(n.get("nextAction"))
    walk(fl["template"]["trigger"]); return sorted(out)

def gate(path, contract):
    r = subprocess.run([sys.executable, os.path.join(FLOW_DIR, "validate_flow.py"), path, "--contract", contract], capture_output=True, text=True, encoding="utf-8")
    return r.returncode, next((x for x in r.stdout.splitlines() if x.startswith("RESULT")), f"exit {r.returncode}"), r.stdout

def delete_step(fl, name):
    """Remove one step from a copy (its successor takes its place) — the mutation the contract must catch."""
    def visit(n):
        if not isinstance(n, dict): return n, False
        if n.get("name") == name: return n.get("nextAction"), True
        for i, c in enumerate(n.get("children") or []):
            nc, hit = visit(c)
            if hit: n["children"][i] = nc; return n, True
        for key in ("firstLoopAction", "nextAction"):
            if isinstance(n.get(key), dict):
                nc, hit = visit(n[key])
                if hit:
                    if nc is None: n.pop(key)
                    else: n[key] = nc
                    return n, True
        return n, False
    return visit(fl["template"]["trigger"])[1]
MUTATIONS = {"DAILY_SCHEDULE": ["step_run_post"], "DAILY_WATCHDOG": ["step_alert_post"], "MARKET_REPORT": ["step_denied_done", "step_gate"],
             "MARKET_ANALYSE": ["step_denied_done", "step_ai"], "MARKET_STORE": ["step_denied_done", "step_new_news"],
             "BROADCAST": ["step_denied_done", "step_send_queue", "step_retry_claim"], "MARKET_PUBLISH": ["step_denied_done", "step_published_update"]}

# ── the honest count: flow/complexity.py walks nextAction only, so a loop's body is invisible to it. Here every loop body is
# counted once on its path (and its credits once per item), routers count as a step and cost 0 (workflow-rules § 1.20). ──
def _chain(n):
    out = []
    while n: out.append(n); n = n.get("nextAction")
    return out
def _is_ret(n): return (n.get("settings") or {}).get("actionName") == "return_response"
def honest_paths(fl):
    def expand(nodes):
        for i, n in enumerate(nodes):
            if n.get("type") == "ROUTER":
                br = n["settings"]["branches"]
                for j, child in enumerate(n.get("children") or []):
                    for lab, sub in expand(_chain(child)):
                        if sub and _is_ret(sub[-1]): yield (br[j]["branchName"] + (" › " + lab if lab else ""), nodes[:i] + [n] + sub)
                        else:
                            for lab2, rest in expand(nodes[i + 1:]): yield (br[j]["branchName"] + (" › " + lab2 if lab2 else ""), nodes[:i] + [n] + sub + rest)
                return
            if n.get("type") == "LOOP_ON_ITEMS":
                def flat(ch):   # a loop inside the body (a 0-or-1 "only if") runs once per item of the outer loop
                    for b in ch:
                        yield b
                        if b.get("type") == "LOOP_ON_ITEMS": yield from flat(_chain(b.get("firstLoopAction")))
                body = list(flat(_chain(n.get("firstLoopAction"))))
                if body and _is_ret(body[-1]):   # the body answers and stops: the steps after the loop run only on 0 items
                    yield ("inner Return", nodes[:i] + [n] + body)
                    for lab, rest in expand(nodes[i + 1:]): yield (lab + " (0 items)", nodes[:i] + [n] + rest)
                    return
                for lab, rest in expand(nodes[i + 1:]):
                    yield (lab, nodes[:i] + [n] + [dict(b, _in_loop=n["name"]) for b in body] + rest)
                return
        yield ("", nodes)
    return list(expand(_chain(fl["template"]["trigger"])))
def credits_of(nodes):
    fixed = sum(1 for n in nodes if n.get("type") != "ROUTER" and not n.get("_in_loop"))
    per = {}
    for n in nodes:
        if n.get("_in_loop"): per[n["_in_loop"]] = per.get(n["_in_loop"], 0) + 1
    return fixed, per

OS_YAML_ADDITIONS = """
## The four flows the owner adds to os.yaml (the builder made them; os.yaml is the owner's)

Why the split: one Studio flow has one trigger, so the 06:20 watchdog cannot live in DAILY_SCHEDULE. Security round 1 then put
the webhook secret check and today's report state in front of every paid step (SA-01..SA-04). One flow cannot do all of it in
14 steps: secret, read today's row, decide, 5 fetches, parse, AI, parse, write, stamp the news, write news, BROADCAST, job,
Return is over 20. A second decision inside a branch would be a router in a router. So the work is a chain of short flows:
MARKET_REPORT (the app's door: secret → today's row → refuse or go) → MARKET_ANALYSE (feeds + the one AI call) → MARKET_STORE
(the writer, which re-checks every field) → BROADCAST → MARKET_PUBLISH (counts, reader copy, job). Each flow-to-flow call carries
?k=<the callee's secret>. No app page calls the four new flows.

```yaml
  - name: DAILY_WATCHDOG
    covers: [R11]
    trigger: { tool: schedule, name: cron_expression }      # "20 6 * * 1-5", Asia/Kolkata
    constants: { holidays: [] }                             # the SAME list as DAILY_SCHEDULE
    writes: []
    actions:
      - name: check
        model: none
        via: custom
        payload: {}
        result: { alerted: boolean }
        rules: ["06:20 IST Mon–Fri: GET reports; no row for today (or the app unreadable) → POST BROADCAST {action: alert} ?k= → Return. BROADCAST writes the fixed alert text"]
        typical_seconds: 4
        credits: 5
        runs_per_month: 22
  - name: MARKET_ANALYSE
    covers: [R2, R3, R4, R5, R6, R7, R8]
    trigger: { tool: webhook, name: catch_webhook, auth: none }   # ?k= checked in the first step
    constants: { news_limit: 40, summary_chars: 300, dedupe_chars: 60, max_age_hours: 48 }
    writes: []
    actions:
      - name: run
        model: none
        via: custom
        payload: { Trigger: string, Report_ID: string }
        result: { Status: string, Articles_Analyzed: number }
        rules: ["Called only by MARKET_REPORT. Five RSS GETs (feeds.* constants) → parse / dedupe / categorise / impact → no news → Failed row; else ONE llm-ai call → parse + check → POST MARKET_STORE ?k="]
        typical_seconds: 45
        credits: 12
        runs_per_month: 30
      - name: rerun
        model: none
        via: custom
        payload: { Report_ID: string }
        result: { Status: string, Articles_Analyzed: number }
        rules: ["As run, for today's Failed report"]
        typical_seconds: 45
        credits: 12
        runs_per_month: 8
  - name: MARKET_STORE
    covers: [R10]
    trigger: { tool: webhook, name: catch_webhook, auth: none }   # ?k= checked in the first step
    constants: { auto_send: true }
    writes: [reports, news_articles]
    actions:
      - name: store
        model: none
        via: custom
        payload: { Mode: string, Trigger: string, Report_ID: string, report: object, articles: array }
        result: { Report_ID: string, Status: string }
        rules: ["Called only by MARKET_ANALYSE. Every text field re-checked (isAdvice; advice in Driver_1 → Failed 'Advice language removed — review'); the WhatsApp text rebuilt. run: no row today → POST; today's Failed → PATCH; Ready / Sent → refused. rerun: only today's Failed. Then news_articles, BROADCAST (Failed → Kind Alert; Ready → only when auto_send), POST /api/jobs/<_job>"]
        typical_seconds: 5
        credits: 13
        runs_per_month: 30
  - name: MARKET_PUBLISH
    covers: [R9, R10]
    trigger: { tool: webhook, name: catch_webhook, auth: none }   # ?k= checked in the first step
    writes: [reports, published_reports]
    actions:
      - name: publish
        model: none
        via: custom
        payload: { Report_ID: string }
        result: { sent: number, failed: number }
        rules: ["Called only by BROADCAST (after send and after retry). From the app's rows: at least one delivery Sent → report Sent + Sent_At + Sent_Count + Failed_Count and UPSERT published_reports (POST, then PATCH); none sent → left Ready, job failed NOTHING_SENT; POST /api/jobs/<_job>"]
        typical_seconds: 6
        credits: 13
        runs_per_month: 46
```
Also: MARKET_REPORT's rules become "the app's door: ?k= secret, action ∈ run | rerun, today's report read BEFORE any paid step (run refused 409
when today is Ready / Sent; rerun only for today's Failed) → POST MARKET_ANALYSE ?k=", and its feeds / limits constants move to
MARKET_ANALYSE; BROADCAST gains a flow-only action  {Report_ID} (no role holds it; the watchdog and MARKET_STORE call it), and
BROADCAST.send derives everything from the report row, never a caller Kind (SA-24): "only today's Ready report (a Sent one re-sends: the 409 skips who has it); a queued 409 → no WhatsApp,
no PATCH; Kind Alert text only from the report row or the fixed watchdog text, one Alert row per admin per attempt (ADMIN-n-HHmm)";
BROADCAST.retry: "Attempts < 3, claimed by PATCH Attempts + 1 where Attempts = the value read; only a claimed row is sent"; the
send / retry rules gain "then POST MARKET_PUBLISH ?k="; DAILY_SCHEDULE's watchdog rule moves to DAILY_WATCHDOG. Flow-to-flow URLs
and secrets are flow constants, not app env vars — the app calls only WEBHOOK_MARKET_REPORT and WEBHOOK_BROADCAST, each with ?k=.
"""

def write_honest_report(flows):
    L = ["", "## Paths with loop bodies counted (tools/build_market_flows.py)", "",
         "`flow/complexity.py` follows `nextAction` only, so the tables above do not see inside a loop. Below, each loop body is counted once on",
         "its path (the budget question) and its credits once per item; a router is a step that costs 0, every other executed step 1 credit",
         "(workflow-rules § 1.20 — the llm-ai model charge on top is UNVERIFIED). All counts are Estimated until Studio's billing confirms them.", "",
         "| flow | path | steps | credits per run |", "|---|---|---:|---|"]
    worst = 0
    for fl in flows:
        for lab, nodes in honest_paths(fl):
            fixed, per = credits_of(nodes); worst = max(worst, len(nodes))
            c = f"{fixed}" + "".join(f" + {k}×{v}" for k, v in per.items())
            L.append(f"| {fl['name']} | {lab or '(single path)'} | {len(nodes)} | {c} |")
    L += ["", f"Longest path with loop bodies counted: **{worst} steps** (budget 14).", OS_YAML_ADDITIONS]
    with open(os.path.join(ROOT, "docs", "flows-complexity.md"), "a", encoding="utf-8", newline="\n") as fh: fh.write("\n".join(L) + "\n")
    return worst

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--mutate", action="store_true"); a = ap.parse_args()
    flows = [b() for b in BUILDERS]
    how = fill_lib(flows)
    failed = []
    for fl in flows:
        name = fl["name"]; d = os.path.join(WF, name); os.makedirs(d, exist_ok=True)
        strip_null(fl["template"]["trigger"])
        path = os.path.join(d, name + ".json"); cpath = os.path.join(d, name + ".contract.json")
        with open(path, "w", encoding="utf-8", newline="\n") as fh: json.dump(fl, fh, indent=2, ensure_ascii=False); fh.write("\n")
        contract = {"flow": name, "connections": "portable", "fire_and_forget": False, "allow_pieces": sorted(fl["pieces"]), "allow_names": names_of(fl),
                    "require_capabilities": CONTRACTS[name], "built_by": "tools/build_market_flows.py"}
        with open(cpath, "w", encoding="utf-8", newline="\n") as fh: json.dump(contract, fh, indent=2, ensure_ascii=False); fh.write("\n")
        with open(os.path.join(d, name + ".CHECKLIST.md"), "w", encoding="utf-8", newline="\n") as fh: fh.write(studio_checklist.checklist(fl, path, SAMPLES[name]) + WIRING)
        rc, line, out = gate(path, cpath)
        print(f"gate {name}.json: {line}")
        if rc != 0: failed.append(name); print(out[-2500:])
        if a.mutate:
            for victim in MUTATIONS[name]:
                mut = copy.deepcopy(fl)
                if not delete_step(mut, victim): print(f"   mutation: {victim} not found"); failed.append(f"{name} (mutation {victim})"); continue
                tmp = tempfile.mkdtemp(); mp = os.path.join(tmp, name + ".json")
                json.dump(mut, open(mp, "w", encoding="utf-8"), ensure_ascii=False)
                mrc, mline, mout = gate(mp, cpath); shutil.rmtree(tmp, ignore_errors=True)
                caught = mrc == 1 and victim in mout
                print(f"   mutation (delete {victim}): {mline} — {'caught' if caught else 'NOT CAUGHT'}")
                if not caught: failed.append(f"{name} (mutation {victim})")
    print(f"library in CODE nodes: {how}")
    c = subprocess.run([sys.executable, os.path.join(FLOW_DIR, "complexity.py"), WF, "--strict", "--out", os.path.join(ROOT, "docs", "flows-complexity.md")], capture_output=True, text=True, encoding="utf-8")
    print(c.stdout.strip().splitlines()[-1] if c.stdout.strip() else c.stderr)
    if c.returncode != 0: failed.append("complexity"); print(c.stdout)
    worst = write_honest_report(flows)
    print(f"longest path with loop bodies counted: {worst} steps (budget 14)")
    if worst > 14: failed.append("honest path count")
    if failed: print("FAILED:", ", ".join(failed)); sys.exit(1)

if __name__ == "__main__":
    main()
