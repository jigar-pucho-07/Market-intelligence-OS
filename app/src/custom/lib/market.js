// app/src/custom/lib/market.js — the Market Intelligence rules, shared by the app (preview, Today's report) and the Studio flows
// (inlined into CODE steps by tools/build_market_flows.py). Plain JS, no imports — rule zero: code formats, the model only writes words.
// Owner after the first commit: the `workflow` agent. The frontend imports only formatWhatsApp / parseSectors / parseRisks.

export const DISCLAIMER =
  'Market commentary generated with AI from public news. Not investment advice and not a research report by a SEBI-registered research analyst. ' +
  'Trading involves risk — consult a SEBI-registered advisor before acting. Yeh AI-generated analysis hai; SEBI-registered investment advisory nahi hai.';

export const WHATSAPP_LIMIT = 4000;

const OUTLOOK_DOT = { BULLISH: '🟢', 'CAUTIOUSLY BULLISH': '🟢', CAUTIOUS: '🟡', NEUTRAL: '🟡', 'CAUTIOUSLY BEARISH': '🔴', BEARISH: '🔴' };

/** "Sector|POSITIVE|reason\n…" → [{ sector, call, reason }] (blank and malformed lines dropped). */
export function parseSectors(text) {
  return String(text || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p.length >= 2 && p[0])
    .map(([sector, call, ...rest]) => ({ sector, call: (call || '').toUpperCase(), reason: rest.join('|') }));
}

/** "HIGH|text\n…" → [{ level, text }]. */
export function parseRisks(text) {
  return String(text || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p.length >= 2 && p[1])
    .map(([level, ...rest]) => ({ level: (level || '').toUpperCase(), text: rest.join('|') }));
}

function istParts(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const fmt = (o) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...o }).format(d);
  return { day: fmt({ weekday: 'long' }), date: fmt({ day: '2-digit', month: 'short', year: 'numeric' }), time: fmt({ hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase() };
}

/**
 * The WhatsApp text of a report row (the n8n "Format WhatsApp Message" node, rebuilt on typed fields).
 * Header (day, date, report time IST) + analysis + "Market Opens: 9:15 AM IST" + disclaimer, ≤ 4,000 characters.
 */
export function formatWhatsApp(r, generatedAt) {
  const t = istParts(generatedAt || r.Created_At || Date.now());
  const line = (label, outlook, extra) => `${label}: ${OUTLOOK_DOT[outlook] || '⚪'} ${outlook || '—'}${extra ? ` | ${extra}` : ''}`;
  const drivers = [r.Driver_1, r.Driver_2, r.Driver_3].filter(Boolean).map((x) => `• ${x}`).join('\n');
  const sectors = parseSectors(r.Sectors).map((s, i) => `${i + 1}. ${s.sector} — ${s.call}${s.reason ? ` — ${s.reason}` : ''}`).join('\n');
  const risks = parseRisks(r.Risks).map((x) => `• ${x.text}${x.level ? ` (${x.level})` : ''}`).join('\n');
  const views = [['Positional', r.View_Positional], ['Intraday', r.View_Intraday], ['Long-term', r.View_LongTerm], ['F&O', r.View_FnO]]
    .filter(([, v]) => v).map(([k, v]) => `• ${k}: ${v}`).join('\n');
  const body = [
    `📈 *DAILY MARKET INTELLIGENCE*`, `━━━━━━━━━━━━━━━━━━━━`, `📅 *${t.day}, ${t.date}*`, `⏰ Report Time: ${t.time} IST`, `━━━━━━━━━━━━━━━━━━━━`, '',
    `🎯 OVERALL MARKET SENTIMENT: *${r.Sentiment || '—'}*`,
    `CONFIDENCE LEVEL: ${r.Confidence_Level || '—'}${r.Confidence_Pct !== undefined && r.Confidence_Pct !== '' ? ` (${r.Confidence_Pct}%)` : ''}`, '',
    drivers && `📌 KEY MARKET DRIVERS TODAY:\n${drivers}\n`,
    `📊 SEGMENT-WISE ANALYSIS:`,
    line('1️⃣ SENSEX', r.Sensex_Outlook, r.Sensex_Range),
    line('2️⃣ NIFTY 50', r.Nifty_Outlook, r.Nifty_Range),
    line('3️⃣ BANK NIFTY', r.BankNifty_Outlook, r.BankNifty_Range),
    `4️⃣ NIFTY F&O: ${r.FnO_View || '—'}${r.VIX_Expectation ? ` | VIX: ${r.VIX_Expectation}` : ''}`,
    line('5️⃣ MID/SMALL CAP', r.MidSmall_Outlook, r.MidSmall_Focus),
    line('6️⃣ COMMODITIES', r.Commodity_Outlook), '',
    sectors && `🔥 SECTORS TO WATCH:\n${sectors}\n`,
    risks && `⚠️ KEY RISKS TODAY:\n${risks}\n`,
    views && `💡 MARKET VIEW:\n${views}\n`,
  ].filter((x) => x !== false && x !== undefined && x !== null && x !== '' || x === '').join('\n');
  const footer = `\n━━━━━━━━━━━━━━━━━━━━\n🤖 *Powered by AI Market Intelligence*\n📊 *Market Opens: 9:15 AM IST*\n━━━━━━━━━━━━━━━━━━━━\n⚠️ ${DISCLAIMER}`;
  const room = WHATSAPP_LIMIT - footer.length;
  const main = body.length > room ? body.slice(0, Math.max(0, room - 60)) + '…\n\n[Full report in the Market Intelligence portal]' : body;
  return main + footer;
}
