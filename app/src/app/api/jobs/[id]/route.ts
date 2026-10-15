// /api/jobs/<id> — a flow that ran longer than the sync window (async: true) reports back here with INBOUND_TOKEN;
// the page's refresh then shows the result. GET (signed-in) answers the job's status for polling.
import { z } from 'zod';
import { inboundAllowed, currentUser, readJson, JSON_MAX_SMALL } from '@/lib/auth';
import { query } from '@/lib/db';
export const dynamic = 'force-dynamic';
const Id = z.string().regex(/^JOB-[0-9A-F]{12}$/);
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser(); if (!user) return Response.json({ error: 'not signed in' }, { status: 401 });
  const id = Id.safeParse((await ctx.params).id); if (!id.success) return Response.json({ error: 'not found' }, { status: 404 });
  const r = await query('SELECT id, flow, action, status, result, created_at, finished_at FROM jobs WHERE id = $1', [id.data]);
  return r[0] ? Response.json(r[0]) : Response.json({ error: 'not found' }, { status: 404 });
}
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!inboundAllowed(req)) return Response.json({ error: 'closed' }, { status: 403 });
  const id = Id.safeParse((await ctx.params).id); if (!id.success) return Response.json({ error: 'not found' }, { status: 404 });
  const rd = await readJson(req, JSON_MAX_SMALL); if (!rd.ok) return rd.res; const body = rd.body;
  const p = z.object({ status: z.enum(['done', 'failed']), result: z.record(z.unknown()).optional() }).strict().safeParse(body);
  if (!p.success) return Response.json({ error: 'status must be done or failed' }, { status: 400 });
  const r = await query('UPDATE jobs SET status = $2, result = $3, finished_at = now() WHERE id = $1 RETURNING id', [id.data, p.data.status, JSON.stringify(p.data.result ?? {})]);
  return r[0] ? Response.json({ ok: true }) : Response.json({ error: 'not found' }, { status: 404 });
}
