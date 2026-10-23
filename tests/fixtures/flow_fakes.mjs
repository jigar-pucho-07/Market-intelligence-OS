// tests/fixtures/flow_fakes.mjs — fakes for flow/flow_sim.mjs that answer like the real services AND fail like them:
// the five feeds answer from the real samples in tests/fixtures/rss/ (Google News searches captured once on 15 Oct 2026;
// the retired feeds.reuters.com host throws, as it does for real), llm-ai answers the stand-in model JSON, pucho-whatsapp answers a message id, another
// flow's webhook answers 200. The app's /api/data door is simulated by flow_sim itself (CLI); tests/flow_sim.test.mjs uses
// makeFakes({ app }) with a stateful app that answers 201 / 409 / 403 the way app/src/app/api/data/[entity] does.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const rss = (f, enc = 'utf8') => fs.readFileSync(path.join(HERE, 'rss', f), enc);
export const MODEL = JSON.parse(fs.readFileSync(path.join(HERE, 'model-answer.json'), 'utf8'));
export class ServiceError extends Error { constructor(status, msg) { super(`HTTP ${status}: ${msg}`); this.status = status; } }

export const FEED_FILES = { 'site:economictimes.indiatimes.com': ['et-markets.xml'], 'site:moneycontrol.com': ['moneycontrol.xml'], 'site:reuters.com': ['reuters-india.xml'],
  'q=India+stock': ['google-finance.xml'], 'q=SGX+Nifty': ['global-cues.xml'] };

/** opts: { feeds: 'down' (every feed fails), model: text the model answers, email: (inputs) => output | throws (Gmail), whatsapp: (inputs) => output | throws,
 *  app: (method, url, query, body) => {status, body}, calls: [] } */
export function makeFakes(opts = {}) {
  const calls = opts.calls || [];
  return async (piece, inputs, node) => {
    calls.push({ piece, node: node.name, inputs });
    if (piece === 'http:send_request') {
      const url = String(inputs.url || '');
      if (/feeds\.reuters\.com/.test(url)) throw new ServiceError(0, 'getaddrinfo ENOTFOUND feeds.reuters.com');
      if (opts.feeds === 'down' && /news.google.com/.test(url)) throw new ServiceError(503, 'feed down');
      for (const [k, [file, enc]] of Object.entries(FEED_FILES)) if (url.includes(k)) return { status: 200, headers: {}, body: rss(file, enc) };
      if (opts.app && /\/api\/(appdata|data|jobs)\//.test(url)) {
        const r = opts.app(String(inputs.method || 'GET').toUpperCase(), url, inputs.queryParams || {}, inputs.body ? inputs.body.data : undefined);
        if (r.status >= 400) throw new ServiceError(r.status, JSON.stringify(r.body));
        return r;
      }
      return { status: 200, headers: {}, body: { ok: true } };          // another flow's webhook (bare URL: answers at once)
    }
    if (piece === 'llm-ai:askLlm') return { data: { response: opts.model ?? MODEL.fenced } };
    if (piece === 'gmail:send_email') {                                // Gmail answers the sent message's id (and thread id)
      if (opts.email) return opts.email(inputs);
      const to = Array.isArray(inputs.receiver) ? inputs.receiver.filter(Boolean) : [];
      if (!to.length || !to.every((a) => /@/.test(a))) throw new ServiceError(400, 'Invalid To header');
      return { id: `18fake${calls.length}`, threadId: `18thr${calls.length}`, labelIds: ['SENT'] };
    }
    if (piece === 'pucho-whatsapp:send_template_message') {
      if (opts.whatsapp) return opts.whatsapp(inputs);
      if (!inputs.to) throw new ServiceError(400, 'to is required');
      return { success: true, messageId: `wamid.FAKE${calls.length}` };
    }
    return {};
  };
}
export default makeFakes();
