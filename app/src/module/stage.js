// stage.js — the pipeline stage ramp (audit M3). A status that belongs to an entity's ordered `status.values`
// darkens as it advances: New (light steel) → … → Negotiation (deep blue). A stage that means success (Won,
// Accepted, Done, Achieved) is green; one that means the record left the pipeline (Lost, Rejected, Expired,
// Cancelled) is a hollow grey ring; "Draft / Pending" style waiting states are amber. Everything reads the same
// map: badges, board column dots, chart series, funnel bars. Not a status? → null, and the caller falls back to
// `toneOf()`.
import { ENTITIES } from '../config/os.config';
import { toneOf } from '../components/ui/primitives';

// Tokens from config/tokens.css: graphite = steel ramp, pastel = along the brand. color-mix() and SVG fill both accept var().
const RAMP = [1, 2, 3, 4, 5, 6].map((i) => `var(--stage-${i})`);
const SUCCESS = 'var(--ok-text)', GONE = 'var(--ink-3)', WAIT = 'var(--warn-text)';
const BAD = /^(lost|rejected|expired|cancelled|canceled|closed|dropped|declined|failed)$/i;
const WAITING = /^(draft|pending|on hold|hold|waiting|awaiting)/i;

const INDEX = (() => {
  const m = new Map();
  for (const [name, e] of Object.entries(ENTITIES)) {
    const vals = e.status?.values ?? []; if (!vals.length) continue;
    // progression = the values that are neither success nor gone nor waiting, in declared order
    const prog = vals.filter((v) => !BAD.test(v) && toneOf(v) !== 'ok' && !WAITING.test(v));
    vals.forEach((v) => { if (!m.has(v)) m.set(v, { entity: name, index: prog.indexOf(v), of: prog.length, value: v }); });
  }
  return m;
})();

/** Hex for a stage value, or null when the value is not a declared status anywhere. */
export function stageHex(value) {
  const s = INDEX.get(String(value ?? '').trim()); if (!s) return null;
  if (BAD.test(s.value)) return GONE;
  if (toneOf(s.value) === 'ok') return SUCCESS;
  if (WAITING.test(s.value)) return WAIT;
  if (s.index < 0 || s.of <= 1) return RAMP[3];
  return RAMP[Math.round((s.index / (s.of - 1)) * (RAMP.length - 1))];
}
export function stageKind(value) {
  const v = String(value ?? '').trim(); if (!INDEX.has(v)) return null;
  return BAD.test(v) ? 'gone' : toneOf(v) === 'ok' ? 'success' : WAITING.test(v) ? 'waiting' : 'stage';
}
/** Inline style for a chip: the stage colour as text on a 12 % tint; a "gone" stage is outlined, not filled. */
export function stageStyle(value) {
  const hex = stageHex(value); if (!hex) return null;
  const kind = stageKind(value);
  if (kind === 'gone') return { color: hex, background: 'transparent', boxShadow: `inset 0 0 0 1px ${hex}` };
  return { color: hex, background: `color-mix(in srgb, ${hex} 12%, var(--surface))` };
}
export function isStage(value) { return INDEX.has(String(value ?? '').trim()); }
