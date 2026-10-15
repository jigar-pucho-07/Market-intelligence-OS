// src/utils/labels.js — v4.9 humanised labels. A column name is a database word (Quote_Value, Enquiry_ID); a person reads
// "Quote value", "Enquiry ID". `humanize(col)` is the one place that turns one into the other, so no raw
// Title_Case_Underscore text reaches the screen unless os.yaml wrote an explicit label.

// Acronyms stay upper-case wherever they appear in a name.
const ACRONYMS = new Set([
  'GST', 'GSTIN', 'ID', 'KYC', 'INR', 'PAN', 'OTP', 'AI', 'SLA', 'PO',
  'URL', 'UPI', 'IFSC', 'HSN', 'SKU', 'API', 'PDF', 'SMS', 'QR', 'TDS', 'EMI', 'KPI', 'USD', 'CRM', 'PIN',
]);

/** Quote_Value → "Quote value" · Customer_Company → "Customer company" · Enquiry_ID → "Enquiry ID" · GSTIN → "GSTIN".
 *  Already-readable text (it has a space and no underscore) is returned unchanged. */
export function humanize(col) {
  if (col === null || col === undefined) return '';
  const raw = String(col).trim(); if (!raw) return '';
  if (/\s/.test(raw) && !raw.includes('_')) return raw;
  const words = raw.replace(/([a-z0-9])([A-Z])/g, '$1_$2').split(/[_\-.\s]+/).filter(Boolean);
  return words.map((w, i) => {
    const up = w.toUpperCase();
    if (ACRONYMS.has(up)) return up;
    const lower = w.toLowerCase();
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
  }).join(' ');
}

/** The label to show for a column: the author's explicit label when there is one, else the humanised name.
 *  `t` is the i18n function; translations written against the older "Customer Company" spelling still match. */
export function labelOf(t, key, explicit) {
  if (explicit) return t ? t(explicit) : explicit;
  const h = humanize(key); if (!t) return h;
  const hit = t(h); if (hit !== h) return hit;
  const legacy = String(key ?? '').replace(/_/g, ' ');
  const old = t(legacy); return old !== legacy ? old : h;
}

/** t('Showing {from} to {to} of {total}') with its placeholders filled. */
export function fillT(text, vars) { return String(text).replace(/\{(\w+)\}/g, (_, k) => String(vars?.[k] ?? '')); }

/** First letter up, the rest untouched — a server message such as "must be > 0" reads as a sentence. */
export const sentence = (s) => { const x = String(s ?? '').trim(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
