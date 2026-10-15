// /api/hooks/<provider> — v4.9 signed webhook door (standards §19, security round). A provider that posts DIRECTLY to
// this app (a payment / claim-status / KYC callback that does not come through Studio with an inbound token) proves it is
// genuine by signing the RAW body with a shared secret; we recompute HMAC-SHA256 over the exact bytes and refuse a bad or
// missing signature with 401. This is separate from the /api/data flow door (bearer token): there the caller is Studio and
// is trusted by its token; here the caller is a third party and is trusted only by a signature over its own body.
//   secret:  WEBHOOK_SECRET_<PROVIDER>   (unset → the provider is closed, 404-style 'unconfigured' as 401)
//   header:  x-webhook-signature: sha256=<hex>   (or x-hub-signature-256)
// On a good signature, if os.yaml mapped this provider to an entity (WEBHOOKS[provider].entity), the body is written through
// the same DAL + v4.9 guards as any other write (computed recomputed, impossible value 400, duplicate 409); otherwise the
// event is acknowledged 200 so a provider that only needs a 2xx stops retrying. The raw body is read with req.text() — never
// re-serialized — because any change to bytes, key order or spacing would change the digest and reject a genuine call.
import { z } from 'zod';
import { verifyWebhookSignature, JSON_MAX } from '@/lib/auth';
import { insertRows, Conflict, NotFound, Invalid, type Actor } from '@/lib/dal';
import { validateEntity, applyComputed, validateStage } from '@/lib/validate';
import { ENTITIES, WEBHOOKS } from '@/config/os.config';

export const dynamic = 'force-dynamic';
const Params = z.object({ provider: z.string().regex(/^[a-z][a-z0-9_-]*$/i).max(60) });

export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const p = Params.safeParse(await ctx.params);
  if (!p.success) return Response.json({ error: 'bad provider' }, { status: 400 });
  const provider = p.data.provider;
  // read the raw bytes (size-capped) before anything else — the signature is over exactly these bytes
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > JSON_MAX) return Response.json({ error: 'body too large' }, { status: 413 });
  const raw = await req.text();
  if (raw.length > JSON_MAX) return Response.json({ error: 'body too large' }, { status: 413 });

  const sig = req.headers.get('x-webhook-signature') || req.headers.get('x-hub-signature-256');
  const bad = verifyWebhookSignature(provider, raw, sig);
  if (bad) return Response.json({ ok: false, error: `webhook signature ${bad}` }, { status: 401 });   // unconfigured / missing / mismatch all 401

  let body: unknown;
  try { body = raw ? JSON.parse(raw) : {}; } catch { return Response.json({ ok: false, error: 'invalid JSON' }, { status: 400 }); }

  const map = (WEBHOOKS as unknown as Record<string, { entity?: string }>)[provider];
  const entity = map?.entity;
  if (!entity || !(entity in (ENTITIES as any))) return Response.json({ ok: true, received: true }, { status: 200 });   // verified, nothing to route → ack

  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ ok: false, error: 'body must be a JSON object' }, { status: 400 });
  const e = (ENTITIES as any)[entity];
  const row = applyComputed(entity, Object.fromEntries(Object.entries(body as Record<string, unknown>).filter(([k]) => e.columns.includes(k))));
  const errors = validateEntity(entity, row) ?? validateStage(entity, '', row);   // field guards, then requires_on for a create into a stage
  if (errors) return Response.json({ ok: false, errors }, { status: 400 });
  const actor: Actor = { kind: 'flow', name: `webhook:${provider}`.slice(0, 80) };
  try {
    const out = await insertRows(actor, entity, [row], { flow: `webhook:${provider}`, action: 'insert' });
    return Response.json({ ok: true, rows: out }, { status: 201 });
  } catch (err) {
    if (err instanceof Conflict) return Response.json({ ok: false, errors: { [err.field]: `already in use (${err.existingId})` } }, { status: 409 });
    if (err instanceof Invalid) return Response.json({ ok: false, errors: { [err.field]: 'is not an allowed value' } }, { status: 400 });
    if (err instanceof NotFound) return Response.json({ ok: false, error: 'not found' }, { status: 404 });
    console.error('api/hooks POST', provider, (err as Error).message);
    return Response.json({ ok: false, error: 'failed' }, { status: 500 });
  }
}
