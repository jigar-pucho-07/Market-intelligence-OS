// /api/data/<entity> — the door a Studio flow writes through (standards §8.1, §15.4; decision D4: Studio reads the
// database with its read-only `studio_reader` role, but every write goes through here, under the same DAL rules as a
// person's request). INBOUND_TOKEN must be presented; unset means closed. The query shape is PostgREST's, so the
// emitter's http nodes did not have to change: GET ?select=* · POST [rows] (idempotent on the id) · PATCH ?<Id>=eq.<v>
// · POST ?mode=replace (a scheduled sync owning its whole table). Bodies are read through lib/auth.ts readJson: ≤ 256 KB, JSON only (v4.7).
import { z } from 'zod';
import { inboundAllowed, inboundToken, readJson, JSON_MAX } from '@/lib/auth';
import { listRows, insertRows, patchRow, replaceRows, getRow, NotFound, Conflict, Invalid, type Actor } from '@/lib/dal';
import { validateEntity, applyComputed, validateStage, needsCurrentRow } from '@/lib/validate';
import { ENTITIES } from '@/config/os.config';

export const dynamic = 'force-dynamic';
const Params = z.object({ entity: z.string().regex(/^[a-z][a-z0-9_]*$/) });
const closed = () => Response.json({ error: 'closed' }, { status: 403 });
// the actor names the flow (X-Flow header) and the token variable that let it in (S8: a leaked token is traceable to one flow)
const actorOf = (req: Request): Actor => ({ kind: 'flow', name: `${(req.headers.get('x-flow') || 'studio').slice(0, 60)}${inboundToken(req) && inboundToken(req) !== 'INBOUND_TOKEN' ? ` [${inboundToken(req)}]` : ''}`.slice(0, 80) });

function rowSchema(entity: string) {
  const e = (ENTITIES as any)[entity];
  return z.object(Object.fromEntries(e.columns.map((c: string) => [c, z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.unknown())]).optional()]))).strict();
}

export async function GET(req: Request, ctx: { params: Promise<{ entity: string }> }) {
  if (!inboundAllowed(req)) return closed();
  const p = Params.safeParse(await ctx.params); if (!p.success || !(p.data.entity in (ENTITIES as any))) return Response.json({ error: 'not found' }, { status: 404 });
  try { return Response.json(await listRows(actorOf(req), p.data.entity)); } catch (e) { return e instanceof NotFound ? Response.json({ error: 'not found' }, { status: 404 }) : Response.json({ error: 'failed' }, { status: 500 }); }
}

export async function POST(req: Request, ctx: { params: Promise<{ entity: string }> }) {
  if (!inboundAllowed(req)) return closed();
  const p = Params.safeParse(await ctx.params); if (!p.success || !(p.data.entity in (ENTITIES as any))) return Response.json({ error: 'not found' }, { status: 404 });
  const rd = await readJson(req, JSON_MAX); if (!rd.ok) return rd.res; const body = rd.body;   // size-capped, JSON only (v4.7)
  const rows = z.array(rowSchema(p.data.entity)).max(5000).safeParse(Array.isArray(body) ? body : [body]);
  if (!rows.success) return Response.json({ error: 'invalid rows', detail: rows.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`) }, { status: 400 });
  // v4.9: a flow writes through the same generated guards as a person — computed recomputed, impossible value / illegal
  // stage a 400, duplicate a 409. Never a 201 for a value the UI would have refused.
  const prepared = rows.data.map((r) => applyComputed(p.data.entity, r as Record<string, unknown>));
  for (const r of prepared) {
    const errors = validateEntity(p.data.entity, r); if (errors) return Response.json({ ok: false, errors }, { status: 400 });
    const stageErr = validateStage(p.data.entity, '', r); if (stageErr) return Response.json({ ok: false, errors: stageErr }, { status: 400 });
  }
  const mode = new URL(req.url).searchParams.get('mode');
  const actor = actorOf(req); const flow = actor.kind === 'flow' ? actor.name : 'studio';
  try {
    if (mode === 'replace') return Response.json({ ok: true, rows: await replaceRows(actor, p.data.entity, prepared as any, { flow }) });
    const out = await insertRows(actor, p.data.entity, prepared as any, { flow, action: 'insert' });
    return Response.json(out, { status: 201 });
  } catch (e) {
    if (e instanceof Conflict) return Response.json({ ok: false, errors: { [e.field]: `already in use (${e.existingId})` } }, { status: 409 });
    if (e instanceof Invalid) return Response.json({ ok: false, errors: { [e.field]: 'is not an allowed value' } }, { status: 400 });
    console.error('api/data POST', (e as Error).message); return Response.json({ error: 'failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ entity: string }> }) {
  if (!inboundAllowed(req)) return closed();
  const p = Params.safeParse(await ctx.params); if (!p.success || !(p.data.entity in (ENTITIES as any))) return Response.json({ error: 'not found' }, { status: 404 });
  const e = (ENTITIES as any)[p.data.entity]; const q = new URL(req.url).searchParams.get(e.id.column) || '';
  const id = q.startsWith('eq.') ? q.slice(3) : q;
  if (!id) return Response.json({ error: `?${e.id.column}=eq.<id> is required` }, { status: 400 });
  const rd = await readJson(req, JSON_MAX); if (!rd.ok) return rd.res; const body = rd.body;   // size-capped, JSON only (v4.7)
  const patch = rowSchema(p.data.entity).safeParse(body);
  if (!patch.success) return Response.json({ error: 'invalid patch' }, { status: 400 });
  const actor = actorOf(req);
  const patchData = patch.data as Record<string, unknown>;
  let cur: Record<string, unknown> | null = null;
  if (needsCurrentRow(p.data.entity)) {                                           // stage move / recompute / no_past need the stored row
    cur = await getRow(actor, p.data.entity, id);
    if (cur) {
      const merged = { ...cur, ...patchData }; const recomputed = applyComputed(p.data.entity, merged);
      for (const k of Object.keys(recomputed)) if (recomputed[k] !== merged[k]) patchData[k] = recomputed[k];   // write only changed computed columns
      const from = String(cur[(e.status?.column ?? '') as string] ?? '');
      const stageErr = validateStage(p.data.entity, from, recomputed);
      if (stageErr) return Response.json({ ok: false, errors: stageErr }, { status: 400 });
    }
  }
  const perrs = validateEntity(p.data.entity, patchData, cur);   // v4.9: guard the patched values too (an unchanged stored no_past date is not re-judged)
  if (perrs) return Response.json({ ok: false, errors: perrs }, { status: 400 });
  try {
    const row = await patchRow(actor, p.data.entity, id, patchData as any, { flow: actor.kind === 'flow' ? actor.name : 'studio', action: 'patch' });
    return row ? Response.json([row]) : Response.json({ error: 'not found' }, { status: 404 });
  } catch (e2) {
    if (e2 instanceof Conflict) return Response.json({ ok: false, errors: { [e2.field]: `already in use (${e2.existingId})` } }, { status: 409 });
    if (e2 instanceof Invalid) return Response.json({ ok: false, errors: { [e2.field]: 'is not an allowed value' } }, { status: 400 });
    console.error('api/data PATCH', (e2 as Error).message); return Response.json({ error: 'failed' }, { status: 500 });
  }
}
