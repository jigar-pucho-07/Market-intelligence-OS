'use client';
// fieldErrors — v4.9 contract C2. A write that fails with `{ ok:false, error, errors: { Column: message } }` surfaces here as
// an Error carrying `.errors` (utils/api.js). `useFieldErrors` maps each Column to a field of the form, keeps the message until
// that field is edited, moves focus to the first invalid field, and hands back whatever could not be shown inline (a non-field
// `error`, or a Column the form does not have) for the caller to toast.
import { useCallback, useState } from 'react';
import { flatFields } from './Fields';
import { humanize, sentence } from '../utils/labels';

const norm = (k) => String(k ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Focus the control of a field after React has painted its error (antd inputs carry id `f-<key>`). */
export function focusField(key) {
  if (typeof document === 'undefined') return;
  const go = () => { const el = document.getElementById(`f-${key}`); if (el) { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch {} el.focus?.({ preventScroll: true }); } };
  requestAnimationFrame(() => requestAnimationFrame(go));
}

export function useFieldErrors() {
  const [errors, setErrors] = useState({});
  const clear = useCallback((key) => setErrors((e) => { if (!(key in e)) return e; const n = { ...e }; delete n[key]; return n; }), []);
  const reset = useCallback(() => setErrors({}), []);
  /** apply(err, fields) → { matched: [field keys in form order], rest: string | '' }.
   *  `rest` is what the caller should toast: the unmatched field messages, or the plain error when no field errors came. */
  const apply = useCallback((err, fields) => {
    const incoming = err?.errors && typeof err.errors === 'object' ? Object.entries(err.errors) : [];
    if (!incoming.length) { setErrors({}); return { matched: [], rest: err?.message || 'Something went wrong' }; }
    const list = flatFields(fields); const byNorm = new Map(list.map((f) => [norm(f.key), f.key]));
    const next = {}; const loose = [];
    for (const [col, msg] of incoming) { const k = byNorm.get(norm(col)); if (k) next[k] = sentence(msg); else loose.push(`${humanize(col)}: ${sentence(msg)}`); }
    setErrors(next);
    const matched = list.map((f) => f.key).filter((k) => k in next);
    if (matched.length) focusField(matched[0]);
    return { matched, rest: loose.join(' · ') };
  }, []);
  return { errors, clear, reset, apply };
}
