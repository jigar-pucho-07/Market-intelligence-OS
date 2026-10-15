// src/lib/renderMessage.js — a client message from a fixed template (os.yaml `sends.message`), rule zero: the words
// are the firm's, the values are the record's, no model is involved. ONE source: the app imports it to show what a
// simulated send would have said, and build_flows.py embeds this same file in the flow's CODE node, so the wired flow
// and the simulation can never word a message differently. Plain JS, no imports — it must run inside Studio as is.
//   send = { to: <payload key>, lang: <payload key>, message: { en, hi, mr, … }, words: { hi: { Adjourned: '…' } }, template: { name, variables: { '1': '{{Col}}' } } }
//   {{Key}} → the payload value · {{constants.x}} → the flow constant · [[ … ]] → dropped when any value inside is empty
//   dates (YYYY-MM-DD or ISO) → "Thu, 2 Oct 2026" / "Thu, 2 Oct 2026, 4:30 pm" in IST · phone → digits with 91 prefix
export function renderMessage(send, vars, constants) {
  const LANG = { english: 'en', en: 'en', hindi: 'hi', hi: 'hi', marathi: 'mr', mr: 'mr', gujarati: 'gu', gu: 'gu', tamil: 'ta', ta: 'ta', telugu: 'te', te: 'te', kannada: 'kn', kn: 'kn', bengali: 'bn', bn: 'bn', malayalam: 'ml', ml: 'ml', punjabi: 'pa', pa: 'pa' };
  const msg = (send && send.message) || {};
  const asked = LANG[String((vars || {})[send.lang] || '').trim().toLowerCase()] || 'en';
  const lang = msg[asked] ? asked : (msg.en ? 'en' : Object.keys(msg)[0]);
  const words = ((send.words || {})[lang]) || {};
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = (v) => {
    const only = /^\d{4}-\d{2}-\d{2}$/.test(v);
    const t = only ? Date.UTC(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)) : Date.parse(v) + 330 * 60000;   // IST without Intl
    if (isNaN(t)) return v; const d = new Date(t);
    let s = `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    if (!only) { const h = d.getUTCHours(), m = d.getUTCMinutes(); s += `, ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; }
    return s;
  };
  const val = (k) => {
    let v = k.indexOf('constants.') === 0 ? (constants || {})[k.slice(10)] : (vars || {})[k];
    if (v === undefined || v === null) return '';
    v = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(v)) v = date(v);
    return words[v] !== undefined ? words[v] : v;
  };
  const fill = (s) => s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => val(k));
  let text = String(msg[lang] || '')
    .replace(/\[\[([\s\S]*?)\]\]/g, (_, part) => (part.match(/\{\{\s*([\w.]+)\s*\}\}/g) || []).every((p) => val(p.replace(/[{}\s]/g, '')) !== '') ? part : '');
  text = fill(text).replace(/[ \t]{2,}/g, ' ').replace(/ +([.,।])/g, '$1').trim();
  const digits = String((vars || {})[send.to] || '').replace(/\D/g, '');
  const to = digits.length === 10 ? '91' + digits : digits;
  // v4.4 — an approved WhatsApp template (os.yaml `sends.template`): the words live on whatsapp.pucho.ai, the flow fills only the
  // variables, each a {{Column}} template rendered the same way as a message. `to_e164` is the `+91…` form pucho-whatsapp takes.
  const tpl = send && send.template; const variables = {};
  if (tpl && tpl.variables) for (const k of Object.keys(tpl.variables)) variables[k] = fill(String(tpl.variables[k])).trim();
  return { to, to_e164: to ? '+' + to : '', lang, text, template: tpl ? (tpl.name || '') : '', variables };
}
