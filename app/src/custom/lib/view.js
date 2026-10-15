// app/src/custom/lib/view.js — display helpers for MarketBrief and PipelineMap (no colours here: tones map to kernel tokens).

export const SOURCES = ['Economic Times Markets', 'Moneycontrol', 'Reuters India', 'Google Finance News', 'Global Market Cues'];

/** tone of an outlook / sentiment / view word: ok · warn · bad · neutral (the kernel's badge vocabulary). */
export function outlookTone(word) {
  const w = String(word ?? '').toUpperCase().trim();
  if (!w) return 'neutral';
  if (w === 'BULLISH' || w === 'CAUTIOUSLY BULLISH' || w === 'BULLISH BIAS' || w === 'POSITIVE') return 'ok';
  if (w === 'BEARISH' || w === 'BEARISH BIAS' || w === 'NEGATIVE') return 'bad';
  if (w === 'CAUTIOUS' || w === 'CAUTIOUSLY BEARISH' || w === 'VOLATILE' || w === 'WATCH') return 'warn';
  return 'neutral'; // NEUTRAL, RANGE-BOUND, unknown
}
export function levelTone(level) { const l = String(level ?? '').toUpperCase(); return l === 'HIGH' ? 'bad' : l === 'MED' || l === 'MEDIUM' ? 'warn' : 'neutral'; }

export const BADGE_CLASS = { ok: 'badge-success', warn: 'badge-warning', bad: 'badge-danger', info: 'badge-info', neutral: 'badge-neutral' };

/** Newest row by Report_Date (then by creation time). */
export function newestRow(rows) {
  const day = (r) => String(r?.Report_Date ?? '').slice(0, 10);
  const at = (r) => String(r?.Created_At ?? r?.Published_At ?? '');
  return [...(rows ?? [])].filter(Boolean).sort((a, b) => day(b).localeCompare(day(a)) || at(b).localeCompare(at(a)))[0] ?? null;
}

const ist = (d, o) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...o }).format(d);
/** "15 Oct 2026, 06:03 AM IST" — empty string when there is no usable timestamp. */
export function istStamp(value) {
  if (!value) return '';
  const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
  return `${ist(d, { day: '2-digit', month: 'short', year: 'numeric' })}, ${ist(d, { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()} IST`;
}
/** "Thursday, 15 Oct 2026" from a Report_Date (date-only strings are read as that calendar day). */
export function longDate(value) {
  const s = String(value ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(value ?? '');
  const d = new Date(`${s}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

/** "Name 18 · Name 0 (failed) · …" → [{ name, count, failed }]. Empty when the text is not in that shape (e.g. "Simulated — …"). */
export function parseSourceStatus(text) {
  return String(text ?? '').split('·').map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^(.*?)\s+(\d+)\s*(\(failed\))?$/i);
    return m ? { name: m[1].trim(), count: Number(m[2]), failed: !!m[3] || Number(m[2]) === 0 } : null;
  }).filter(Boolean);
}
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** The five sources in legend order, each with a count when Source_Status carries one. */
export function sourceRows(sourceStatus) {
  const parsed = parseSourceStatus(sourceStatus);
  return SOURCES.map((name) => { const hit = parsed.find((p) => norm(p.name) === norm(name)); return { name, count: hit ? hit.count : null, failed: hit ? hit.failed : false }; });
}
