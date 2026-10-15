'use client';
// src/utils/api.js — the kernel's write path and CSV helpers. The browser never talks to the database or to Studio:
// runAction(spec, payload) calls the Server Action, which authorises the person, applies the action (through the wired
// workflow, or the app's own effect while the flow is not wired — the result then says `simulated: true`) and writes the
// audit row. Afterwards `os:data-changed` refreshes the page's data from the server.
import * as actions from '../app/actions';

let WHO = '';
let PAGE = '';
export function rememberWho(name) { WHO = name || ''; }
export function whoAmI() { return WHO; }
export function rememberPage(id) { PAGE = id || ''; }

const changed = () => window.dispatchEvent(new Event('os:data-changed'));

// runAction(spec, payload): spec has { flow, action } (a workflow action) or { direct: 'insert'|'patch', entity }.
export async function runAction(spec, payload = {}) {
  const clean = Object.fromEntries(Object.entries(spec || {}).filter(([k]) => ['flow', 'action', 'direct', 'entity'].includes(k)));
  const res = await actions.runAction({ pageId: PAGE, spec: clean, payload });
  if (res && res.ok === false) {
    const err = new Error(res.error || 'The request failed'); if (res.code) err.code = res.code;
    if (res.errors && typeof res.errors === 'object') err.errors = res.errors;   // v4.9 C2: { Column: message } — rendered inline under each field (module/fieldErrors.js)
    if (/not wired/i.test(res.error || '')) err.code = 'NOT_WIRED';
    throw err;
  }
  changed();
  return res;
}
export const callWorkflow = (flow, action, payload = {}) => runAction({ flow, action }, payload);
export const directWrite = (op, entity, payload = {}) => runAction({ direct: op, entity }, payload);

export async function fetchRows(entity) {
  const r = await actions.readEntity({ entity });
  if (!r.ok) throw new Error(r.error || `Failed to load ${entity}`);
  return r.rows;
}

export async function uploadFile(file) {
  const fd = new FormData(); fd.append('file', file);
  const r = await actions.uploadFile(fd);
  if (!r.ok) throw new Error(r.message || 'Upload failed');
  return r;   // { id, url }
}

// ---- CSV (export) ----
export function toCSV(rows, columns) {
  const cols = columns ?? Object.keys(rows[0] ?? {});
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
export function downloadCSV(rows, name, columns) {
  const blob = new Blob([toCSV(rows, columns)], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}
