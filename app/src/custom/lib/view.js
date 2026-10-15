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
  return [...(Array.isArray(rows) ? rows : [])].filter(Boolean).sort((a, b) => day(b).localeCompare(day(a)) || at(b).localeCompare(at(a)))[0] ?? null;
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

/** "Name 18 · Name 0 (failed: HTTP 500) · Name 7 (3 stale) · …" → [{ name, count, note, failed, stale }].
 *  A count of 0, or any note that is not "stale", is a failure; a stale note keeps its count. Empty when the text is not in that shape (e.g. "Simulated — …"). */
export function parseSourceStatus(text) {
  return String(text ?? '').split('·').map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^(.*?)\s+(\d+)\s*(?:\((.*)\))?$/);
    if (!m) return null;
    const count = Number(m[2]); const note = (m[3] ?? '').trim(); const stale = /stale/i.test(note);
    return { name: m[1].trim(), count, note, stale, failed: count === 0 || (!!note && !stale) };
  }).filter(Boolean);
}
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
/** The five sources in legend order, each with its count and state when Source_Status carries one. */
export function sourceRows(sourceStatus) {
  const parsed = parseSourceStatus(sourceStatus);
  return SOURCES.map((name) => {
    const hit = parsed.find((p) => norm(p.name) === norm(name));
    return hit ? { name, count: hit.count, note: hit.note, stale: hit.stale, failed: hit.failed } : { name, count: null, note: '', stale: false, failed: false };
  });
}
/** One line for the whole set: { tone: ok | warn | bad | neutral, text }. "All 5 answered" only when every source has articles and no note. */
export function sourceSummary(sources) {
  const seen = sources.filter((s) => s.count !== null);
  if (!seen.length) return { tone: 'neutral', text: 'Counts not recorded' };
  const failed = seen.filter((s) => s.failed).length; const stale = seen.filter((s) => !s.failed && s.stale).length;
  if (failed === sources.length) return { tone: 'bad', text: 'No source returned articles' };
  if (failed) return { tone: 'warn', text: `${failed} of ${sources.length} returned nothing or failed` };
  if (seen.length < sources.length) return { tone: 'warn', text: `Only ${seen.length} of ${sources.length} sources reported` };
  if (stale) return { tone: 'warn', text: `${stale} of ${sources.length} sources had stale items` };
  return { tone: 'ok', text: `All ${sources.length} sources answered` };
}

/** True when a Report_Date is today's calendar day in Asia/Kolkata. */
export function isTodayIST(reportDate, now = new Date()) {
  const s = String(reportDate ?? '').slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return s === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** What the preview shows: the stored message (exactly what was sent), else the formatter's text for a row without one; nothing for a Failed row. */
export function whatsappText(row, format) {
  const stored = row?.WhatsApp_Message;
  if (stored !== undefined && stored !== null && String(stored).trim() !== '') return String(stored);
  if (row?.Status === 'Failed') return '';
  return format(row);
}

/** A row without its null / undefined fields, so nothing downstream can print "null". */
export function cleanRow(row) {
  return row ? Object.fromEntries(Object.entries(row).filter(([, v]) => v !== null && v !== undefined)) : null;
}
/** Tone of one source row: ok · warn (zero, failure note or stale items) · neutral (no count recorded). */
export function sourceTone(s, counted) { return !counted || s.count === null ? 'neutral' : s.failed || s.stale ? 'warn' : 'ok'; }
/** The right-hand figure of a source row: "18", "0 · failed: HTTP 500", "7 · 3 stale". */
export function sourceFigure(s) { return s.count === null ? '' : s.count === 0 ? `0 · ${s.note || 'no articles'}` : s.note ? `${s.count} · ${s.note}` : String(s.count); }
