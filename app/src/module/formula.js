// src/module/formula.js — KPI formulas from os.yaml: "count", "count where Stage=Open", "sum Amount_INR where Status!=Paid",
// "avg Hours", "count where Created_At in month", "count where Next_Followup_At<today and Stage not in [Won,Lost]".
import { parseISO, isValid, startOfMonth, startOfDay, subDays } from 'date-fns';

export function toDate(v) {
  if (!v) return null; const d = typeof v === 'string' ? parseISO(v) : new Date(v);
  if (isValid(d)) return d; const d2 = new Date(v); return isValid(d2) ? d2 : null;
}
export function toNum(v) { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return isNaN(n) ? 0 : n; }

function parseList(s) { return s.replace(/^\[|\]$/g, '').split(',').map((x) => x.trim()).filter(Boolean); }
function cond(expr) {
  expr = expr.trim();
  let m;
  if ((m = expr.match(/^(\w+)\s+not in\s+(\[.*\])$/i))) { const [, c, l] = m; const vals = parseList(l); return (r) => !vals.includes(String(r[c] ?? '')); }
  if ((m = expr.match(/^(\w+)\s+in\s+(\[.*\])$/i))) { const [, c, l] = m; const vals = parseList(l); return (r) => vals.includes(String(r[c] ?? '')); }
  if ((m = expr.match(/^(\w+)\s+in\s+month$/i))) { const c = m[1]; const som = startOfMonth(new Date()); return (r) => { const d = toDate(r[c]); return d && d >= som; }; }
  if ((m = expr.match(/^(\w+)\s+in\s+last\s+(\d+)\s*days$/i))) { const c = m[1]; const from = subDays(new Date(), +m[2]); return (r) => { const d = toDate(r[c]); return d && d >= from; }; }
  if ((m = expr.match(/^(\w+)\s*(=|is)\s*today$/i))) { const c = m[1]; const t = startOfDay(new Date()); const t1 = new Date(t.getTime() + 864e5); return (r) => { const d = toDate(r[c]); return !!d && d >= t && d < t1; }; }
  // "Col < today", "Col <= today+7", "Col >= today-30" — day arithmetic on the calendar day, never on the clock.
  if ((m = expr.match(/^(\w+)\s*(<=|>=|<|>)\s*today\s*([+-]\s*\d+)?$/i))) { const [, c, op, off] = m; const t = new Date(startOfDay(new Date()).getTime() + (off ? parseInt(off.replace(/\s/g, ''), 10) : 0) * 864e5); return (r) => { const d = toDate(r[c]); if (!d) return false; return op === '<' ? d < t : op === '<=' ? d < new Date(t.getTime() + 864e5) : op === '>' ? d >= new Date(t.getTime() + 864e5) : d >= t; }; }
  if ((m = expr.match(/^(\w+)\s*(<=|>=|<|>)\s*(-?[\d.]+)$/))) { const [, c, op, n] = m; const v = +n; return (r) => { const x = toNum(r[c]); return op === '<' ? x < v : op === '<=' ? x <= v : op === '>' ? x > v : x >= v; }; }
  if ((m = expr.match(/^(\w+)\s*!=\s*(.+)$/))) { const [, c, v] = m; return (r) => String(r[c] ?? '') !== v.trim(); }
  if ((m = expr.match(/^(\w+)\s*=\s*(.+)$/))) { const [, c, v] = m; return (r) => String(r[c] ?? '') === v.trim(); }
  if ((m = expr.match(/^(\w+)\s+is\s+empty$/i))) { const c = m[1]; return (r) => !String(r[c] ?? '').trim(); }
  if ((m = expr.match(/^(\w+)\s+is\s+set$/i))) { const c = m[1]; return (r) => !!String(r[c] ?? '').trim(); }
  return () => true;
}
export function resolveWhere(clause, user) { return clause && user?.name ? clause.replaceAll('{{user}}', user.name) : clause; }
export function where(rows, clause, user) {
  clause = resolveWhere(clause, user);
  if (!clause) return rows;
  const parts = clause.split(/\s+and\s+/i).map(cond);
  return rows.filter((r) => parts.every((p) => p(r)));
}
export function evalFormula(formula, rows, user) {
  const f = resolveWhere(String(formula).trim(), user);
  const [head, clause] = f.split(/\s+where\s+/i);
  const subset = where(rows, clause, user);
  const m = head.match(/^(count|sum|avg|max|min|distinct)(?:\s+(\w+))?$/i);
  if (!m) return subset.length;
  const [, fn, col] = m; const nums = col ? subset.map((r) => toNum(r[col])) : [];
  if (fn === 'count') return subset.length;
  if (fn === 'distinct') return new Set(subset.map((r) => String(r[col] ?? '').trim()).filter(Boolean)).size;   // "distinct Region"

  if (fn === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (fn === 'avg') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  if (fn === 'max') return nums.length ? Math.max(...nums) : 0;
  if (fn === 'min') return nums.length ? Math.min(...nums) : 0;
  return subset.length;
}
export function formatValue(v, fmt) {
  if (fmt === 'money') return `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (fmt === 'money_l') { const n = Number(v || 0); const a = Math.abs(n); const f = (x) => x.toFixed(x >= 100 ? 0 : 1).replace(/\.0$/, ''); return a >= 1e7 ? `₹${f(n / 1e7)} Cr` : a >= 1e5 ? `₹${f(n / 1e5)} L` : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
  if (fmt === 'pct') return `${Number(v || 0).toFixed(0)}%`;
  if (fmt === 'hours') return `${Number(v || 0).toFixed(1)}h`;
  if (typeof v === 'number') return Number.isInteger(v) ? v : v.toFixed(1);
  return v;
}
