#!/usr/bin/env python3
"""Contract tests — mock mode checks os.yaml declarations; webhook mode POSTs each action to its Studio URL from app/src/config/os.config.js.
Run from the OS root: python tests/test_os.py --mode mock|webhook"""
import os, sys, json, re, argparse, urllib.request, yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
o = yaml.safe_load(open(os.path.join(ROOT, "os.yaml")))
a = argparse.ArgumentParser(); a.add_argument("--mode", default="mock"); args = a.parse_args()
fails = 0
def check(c, m):
    global fails; print(("PASS " if c else "FAIL ") + m); fails += 0 if c else 1
hooks = {}
for fn in (".env.local", ".env"):
    p = os.path.join(ROOT, "app", fn)
    if os.path.exists(p):
        for line in open(p):
            m = re.match(r"^\s*WEBHOOK_([A-Z0-9_]+)\s*=\s*(\S+)", line)
            if m: hooks.setdefault(m.group(1), m.group(2))
def hook_for(flow): return hooks.get(re.sub(r"[^A-Z0-9]", "_", flow.upper()))
for f in o["flows"]:
    for act in f["actions"]:
        key = f"{f['name']}.{act['name']}"
        if args.mode == "mock":
            check(bool(act.get("result")), f"{key}: declares a result")
            check(act.get("model", "none") == "none" or "Reply ONLY with JSON" in str(act.get("prompt", "")), f"{key}: prompt asks for JSON")
            continue
        url = hook_for(f["name"])
        if not url or "REPLACE" in url: check(False, f"{key}: WEBHOOK_* not set in app/.env"); continue
        payload = {"action": act["name"], **{k: (1 if v == "number" else f"test {k}") for k, v in (act.get("payload") or {}).items()}}
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=90) as r: body = json.loads(r.read() or b"{}"); status = r.status
        except Exception as e: check(False, f"{key}: {e}"); continue
        check(status == 200, f"{key}: HTTP {status}")
        got = set(body.get("result", body).keys()) if isinstance(body, dict) else set()
        check(set((act.get("result") or {}).keys()) <= got, f"{key}: result keys {sorted(set((act.get('result') or {}).keys()) - got) or 'complete'}")
print(f"\n{fails} failing"); sys.exit(1 if fails else 0)
