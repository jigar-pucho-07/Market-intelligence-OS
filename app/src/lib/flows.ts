// src/lib/flows.ts — the seam between the app and Pucho AI Studio (method/webhook-contract.md). Server-side only:
// the webhook URL for a flow is WEBHOOK_<FLOW> in the environment (a door, never in the bundle). When it is set the
// flow owns the action — the app posts the payload and the flow writes through /api/data with INBOUND_TOKEN. When it is
// NOT set the app applies the action's declared data effect itself (os.yaml `effect:`, formerly `demo:`) and marks the
// result SIMULATED, so a build is usable and gateable before any workflow exists and never pretends an AI step ran.
import 'server-only';
import { randomBytes } from 'node:crypto';
import { query } from './db';
import { ENTITIES, FLOW_ACTIONS } from '@/config/os.config';
import { insertRows, patchRow, listRows, getRow, nextId, type Actor } from './dal';
import { guardInsert, guardPatch, needsCurrentRow } from './validate';
import { signPayloadFiles } from './fileLinks';
import { renderMessage } from './renderMessage';

const SYNC_TIMEOUT_MS = 25_000;    // Studio answers a /sync webhook within ~25 s; anything longer is queued (async: true)

export const envName = (flow: string) => `WEBHOOK_${flow.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
export const webhookUrl = (flow: string): string | null => { const v = process.env[envName(flow)]; return v && v.trim() && !/REPLACE|SET_|<.*>/i.test(v) ? v.trim() : null; };
export function wiring(): { wired: number; total: number; unwired: string[] } {
  const flows = [...new Set(Object.keys(FLOW_ACTIONS as unknown as Record<string, unknown>).map((k) => k.split('.')[0]))];
  const unwired = flows.filter((f) => !webhookUrl(f));
  return { wired: flows.length - unwired.length, total: flows.length, unwired };
}

type Effect = { insert?: string; patch?: string; fill?: Record<string, unknown>; map?: Record<string, string>; only?: string[]; result?: Record<string, unknown>; also?: Effect; lines?: { entity: string; by: string } };
// `send` (v4.1 + v4.2, D6): to — a payload/row key · 'contact' (the entity's contact block) · { entity, match, by, column } (a lookup) ·
// { role } (every active user of that role); the app resolves it into payload.To (actions.ts resolveSend). message — per language, or one
// string (= en), rendered by lib/renderMessage.js; from — a drafted column the app copies into payload.Message; review — the person may edit
// a pre-filled text before it leaves.
type Send = { tool?: string; provider?: string; to?: string | { entity: string; match: string; by: string; column: string } | { role: string }; lang?: string; message?: Record<string, string>; words?: Record<string, Record<string, string>>; from?: string; review?: boolean; template?: { name?: string; variables?: Record<string, string> } };
type Meta = { effect?: Effect; async?: boolean; sends?: boolean; send?: Send; constants?: Record<string, unknown> };
/** The action's declared data effect, applied by the app (rule zero: CRUD is code). Returns the result the flow would have. */
export async function applyEffect(actor: Actor, flow: string, action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const meta = ((FLOW_ACTIONS as unknown as Record<string, Meta>)[`${flow}.${action}`] ?? {}) as Meta; const spec = meta.effect ?? {};
  const result: Record<string, unknown> = { ...(spec.result ?? { ok: true }) };
  const now = new Date().toISOString();
  const fillOf = (f?: Record<string, unknown>) => Object.fromEntries(Object.entries(f ?? {}).map(([k, v]) => [k, v === 'now' ? now : v]));
  const mapped = (m?: Record<string, string>) => Object.fromEntries(Object.entries(m ?? {}).filter(([k]) => payload[k] !== undefined).map(([k, c]) => [c, payload[k]]));
  // v4.9: every write is guarded BEFORE any is made (computed recomputed, field rules, stage machine — lib/validate.ts), so a
  // modal or a Kanban move through a not-yet-wired flow is refused exactly as the /api/data door refuses it, and an effect
  // that inserts and then patches never half-applies. A refusal is the field-keyed error map the form renders inline.
  const refuse = (errors: Record<string, string>) => ({ ok: false, error: 'Please check the values', errors });
  let insRow: Record<string, unknown> | null = null;
  if (spec.insert) {
    const e = (ENTITIES as any)[spec.insert]; const row: Record<string, unknown> = { ...payload, ...mapped(spec.map), ...fillOf(spec.fill) };
    for (const [k, v] of Object.entries(result)) if (e.columns.includes(k)) row[k] = v;
    const g = guardInsert(spec.insert, Object.fromEntries(Object.entries(row).filter(([k]) => e.columns.includes(k))));
    if (g.errors) return refuse(g.errors);
    insRow = { ...row, ...g.row };
  }
  const plans: { sp: Effect; id: string; patch: Record<string, unknown> }[] = [];
  for (const sp of [spec.patch ? spec : null, spec.also?.patch ? spec.also : null]) {
    if (!sp) continue;
    const e = (ENTITIES as any)[sp.patch!]; const id = String(payload[e.id.column] ?? '');
    if (!id) continue;
    let patch = Object.fromEntries(Object.entries({ ...payload, ...mapped(sp.map) }).filter(([k, v]) => e.columns.includes(k) && k !== e.id.column && v !== undefined && v !== null && (sp.only ? String(v) !== '' : true)));
    if (sp.only) patch = Object.fromEntries(Object.entries(patch).filter(([k]) => sp.only!.includes(k)));
    const cur = needsCurrentRow(sp.patch!) ? await getRow(actor, sp.patch!, id) : null;   // read as the caller: scope applies
    const g = guardPatch(sp.patch!, { ...patch, ...fillOf(sp.fill) }, cur);
    if (g.errors) return refuse(g.errors);
    plans.push({ sp, id, patch: g.patch });
  }
  if (spec.insert && insRow) {
    const e = (ENTITIES as any)[spec.insert];
    const [ins] = await insertRows(actor, spec.insert, [insRow], { flow, action });
    if (ins) { result[e.id.column] = ins[e.id.column]; await fanOutLines(actor, flow, action, spec, payload, ins[e.id.column]); }
  }
  for (const pl of plans) {
    const e = (ENTITIES as any)[pl.sp.patch!];
    await patchRow(actor, pl.sp.patch!, pl.id, pl.patch, { flow, action });
    result[e.id.column] = pl.id;
    if (pl.sp === spec) await fanOutLines(actor, flow, action, spec, payload, pl.id);
  }
  // A templated send is rendered by the same code the flow runs (lib/renderMessage.js) and returned, NOT sent:
  // the person sees the exact words, the language and the number, labelled simulated (contract rule 8).
  if (meta.send?.message || meta.send?.template) { const spec = typeof meta.send.to === 'string' && meta.send.to !== 'contact' ? meta.send : { ...meta.send, to: 'To' };   // a structured recipient was resolved into payload.To by the app (D6)
    const m = renderMessage(spec as Parameters<typeof renderMessage>[0], { ...payload, ...result }, meta.constants ?? {});
    // a template send (v4.4): the approved words live on whatsapp.pucho.ai — the simulation shows the template's name and the variables it would fill
    result.would_send = { channel: meta.send.tool === 'whatsapp' ? 'WhatsApp' : 'Email', ...m, text: m.text || (m.template ? `template "${m.template}" · ${Object.entries(m.variables || {}).map(([k, v]) => `${k}: ${v}`).join(' · ')}` : '') }; }
  return { ok: true, simulated: true, ...result };
}

/** A builder's `lines` array lands in the items entity carrying the head entity's id (the emitter's lines_steps, in code). */
async function fanOutLines(actor: Actor, flow: string, action: string, spec: Effect, payload: Record<string, unknown>, headId: string) {
  const L = spec.lines; if (!L) return;
  const raw = payload.lines; const lines: Record<string, unknown>[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? JSON.parse(raw || '[]') : [];
  if (!lines.length) return;
  const it = (ENTITIES as any)[L.entity]; const iid = it.id.column;
  const rows = lines.filter((l) => !l[iid] || String(l[iid]).startsWith('new-')).map((l) => {
    const r: Record<string, unknown> = {}; for (const c of it.columns) if (c in l && c !== iid) r[c] = l[c];
    r[L.by] = headId; return r;
  });
  if (rows.length) await insertRows(actor, L.entity, rows, { flow, action, audit: false });
}

/** Run one action: through the wired flow, or through the app's own effect when the flow is not wired yet. */
export async function runFlowAction(actor: Actor, flow: string, action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const url = webhookUrl(flow); const meta = ((FLOW_ACTIONS as unknown as Record<string, Meta>)[`${flow}.${action}`] ?? {}) as Meta;
  const who = actor.kind === 'user' ? actor.user.name : actor.kind === 'flow' ? `flow:${actor.name}` : actor.kind;
  if (!url) return applyEffect(actor, flow, action, payload);
  // An upload is served to signed-in people only; the flow gets a 15-minute link to that one file (lib/fileLinks.ts).
  const signed = signPayloadFiles(payload);
  if (signed.unsigned.length) return { ok: false, error: `Set APP_ORIGIN and AUTH_PEPPER so the workflow can read the uploaded file (${signed.unsigned.join(', ')})`, code: 'FILE_LINK' };
  payload = signed.payload;
  const body = JSON.stringify({ action, _who: who, ...payload });
  if (meta.async) {
    const id = `JOB-${randomBytes(6).toString('hex').toUpperCase()}`;
    await query('INSERT INTO jobs (id, flow, action, payload, requested_by) VALUES ($1, $2, $3, $4, $5)', [id, flow, action, JSON.stringify(payload), who]);
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, _who: who, _job: id, ...payload }) })
      .catch((e) => query('UPDATE jobs SET status = $2, result = $3, finished_at = now() WHERE id = $1', [id, 'failed', JSON.stringify({ error: String(e) })]));
    return { ok: true, queued: true, job: id };
  }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), SYNC_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: ctl.signal });
    const text = await res.text();
    if (res.status === 429) return { ok: false, error: 'Too many requests — try again in a minute', code: 'RATE_LIMITED' };
    if (res.status === 402) return { ok: false, error: 'This account has used its AI credit budget', code: 'BUDGET' };
    if (!res.ok) return { ok: false, error: `Workflow ${flow}/${action} failed (${res.status})` };
    try { return JSON.parse(text); } catch { return { ok: true, raw: text }; }
  } catch (e) {
    return { ok: false, error: (e as Error).name === 'AbortError' ? `Workflow ${flow}/${action} did not answer within ${SYNC_TIMEOUT_MS / 1000}s` : `Workflow ${flow}/${action} unreachable` };
  } finally { clearTimeout(t); }
}

/** One-time codes are offered only when something can deliver them (audit S6). Unset WEBHOOK_AUTH_OTP = the login page shows
 *  no code option and requestCode refuses; a code is never written to a log, where anyone who reads logs could sign in as anyone. */
export const otpAvailable = () => !!webhookUrl('AUTH_OTP');

/** One-time sign-in code delivery: the app renders the message, the flow sends it (standards §7). */
export async function deliverCode(email: string, code: string, osName: string): Promise<'sent' | 'simulated'> {
  const url = webhookUrl('AUTH_OTP');
  const subject = `${osName}: your sign-in code`; const text = `Your one-time sign-in code for ${osName} is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`;
  if (!url) return 'simulated';   // unreachable from requestCode (it checks otpAvailable first); kept so a caller can never log a code by accident
  await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send_code', to: email, subject, text }) }).catch(() => {});
  return 'sent';
}

export { listRows, nextId };
