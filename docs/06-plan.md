# 06 — Plan · Market Intelligence (eleven steps)
1. Requirement collection — problem card + gaps + the first operating-cost estimate (`docs/estimate.md`, credits/month, workflow-wise) ✔
2. Analysis — os.yaml confirmed; `fidelity_check.py` PASS against the problem card ✔
3. Docs + scaffold — this repo; `npm run db:migrate && npm run db:seed`; gate: `npm run build` + `npm run check` + `ui_check.py` desktop and `--mobile` at 0 failures (except pending custom stubs)
4. UI (Pucho Code) — replace `custom` sections in `app/src/custom/`; gate: `ui_check.py` desktop + mobile at 0 failures
5. Client approval — click-through on demo data, every persona
6. Workflows — `python scripts/build_flows.py` (re-counts `docs/estimate.md` on the built flows); import; gate: import log + one test run per flow
7. Integration — the client database from `docs/db-setup.md`; `WEBHOOK_<FLOW>` + `INBOUND_TOKEN` in the environment (`docs/import-sheet.md`); first admin created; `npm run package` → CP Portal
8. Testing — `python tests/test_os.py --mode webhook`; `docs/test-cases.md`
9. QA round — `python scripts/qa_os.py . --url <deployed>` prints the plan; with the owner's yes, `--yes` → `docs/qa-report.md` at 0 failures
10. Final review + delivery — test report, `docs/estimate.md` (counted; `--actual` after a month), runbook, handover pack
11. Change requests — edit os.yaml, `diff_os.py` → migration first, then deploy, then re-gate
