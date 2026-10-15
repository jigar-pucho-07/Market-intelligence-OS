// POST /api/files — the door a Studio flow puts an IMAGE through (from Reel Lab, Oct 2026: a flow could write rows but not a
// picture, so anything collected from a third-party CDN whose links expire could never be shown — the app's CSP serves only its
// own origin). Same rule as /api/data: INBOUND_TOKEN must be presented; unset means closed. Images only, checked by magic
// bytes (never by the name or the declared type), size-capped, and shrunk to a thumbnail before it is stored so the plan's
// storage cap lasts. The app never fetches a URL on a flow's behalf (no SSRF surface): the flow sends the bytes.
// With `column`, the record's column is set to the stored picture's URL in the same call (one write, audited as the flow) — a
// flow does not need a second PATCH per picture. The column must be one the entity declares.
//   body: { "name": "RL-abc.jpg", "data_base64": "<bytes>", "entity": "reels", "record_id": "RL-abc", "column": "Thumbnail_URL", "max_width": 320 }
//   201 : { "id": "F-…", "url": "/api/files/F-…", "bytes": 18234, "resized": true, "linked": true }
// A person's upload (a modal field `type: file`) goes through the Server Action `uploadFile` instead — this door is for flows.
import { z } from 'zod';
import { inboundAllowed, inboundToken, readJson, JSON_MAX_FILE } from '@/lib/auth';
import { storeFile, patchRow, type Actor } from '@/lib/dal';
import { ENTITIES } from '@/config/os.config';

export const dynamic = 'force-dynamic';
const IMAGE: [string, number[]][] = [['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/jpeg', [0xff, 0xd8, 0xff]], ['image/webp', [0x52, 0x49, 0x46, 0x46]]];
const Body = z.object({ name: z.string().min(1).max(120), data_base64: z.string().min(8).max(4_200_000), entity: z.string().regex(/^[a-z][a-z0-9_]*$/).max(60).optional(),
                        record_id: z.string().max(120).optional(), column: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/).max(60).optional(), max_width: z.number().int().min(64).max(1280).optional() }).strict();

export async function POST(req: Request) {
  if (!inboundAllowed(req)) return Response.json({ error: 'closed' }, { status: 403 });
  const rd = await readJson(req, JSON_MAX_FILE); if (!rd.ok) return rd.res; const raw = rd.body;   // ≤ 4.5 MB, JSON only (v4.7)
  const p = Body.safeParse(raw); if (!p.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  let data: Buffer = Buffer.from(p.data.data_base64, 'base64');
  if (data.length < 16 || data.length > 3 * 1024 * 1024) return Response.json({ error: 'image must be under 3 MB' }, { status: 413 });
  let mime = IMAGE.find(([, sig]) => sig.every((b, i) => data[i] === b))?.[0];
  if (!mime) return Response.json({ error: 'only PNG, JPEG and WebP images are accepted' }, { status: 415 });
  const ent = p.data.entity ? (ENTITIES as any)[p.data.entity] : null;
  if (p.data.entity && !ent) return Response.json({ error: 'unknown entity' }, { status: 404 });
  if (p.data.column && !(ent && p.data.record_id && ent.columns.includes(p.data.column) && p.data.column !== ent.id.column)) return Response.json({ error: 'column needs an entity, a record_id and a declared column' }, { status: 400 });
  // Shrink to a thumbnail. `sharp` is a dependency; if it fails to load on a platform the image is kept only when already small.
  let resized = false;
  try {
    const sharp = (await import('sharp')).default;
    data = await sharp(data, { failOn: 'error' }).rotate().resize({ width: p.data.max_width ?? 320, withoutEnlargement: true }).jpeg({ quality: 72, mozjpeg: true }).toBuffer();
    mime = 'image/jpeg'; resized = true;
  } catch { if (data.length > 300 * 1024) return Response.json({ error: 'image could not be resized and is over 300 KB' }, { status: 413 }); }
  // the actor names the flow and the token that let it in (S8), as /api/data does
  const tok = inboundToken(req); const actor: Actor = { kind: 'flow', name: `${(req.headers.get('x-flow') || 'studio').slice(0, 60)}${tok && tok !== 'INBOUND_TOKEN' ? ` [${tok}]` : ''}`.slice(0, 80) };
  try {
    const r = await storeFile(actor, { name: p.data.name.replace(/[^\w.\-]/g, '_'), mime, data, entity: p.data.entity, recordId: p.data.record_id });
    const linked = p.data.column ? !!(await patchRow(actor, p.data.entity!, p.data.record_id!, { [p.data.column]: r.url }, { flow: actor.name, action: 'picture' })) : false;
    return Response.json({ ...r, bytes: data.length, resized, linked }, { status: 201 });
  } catch (e) { const m = (e as Error).message; return Response.json({ error: /cap|over/i.test(m) ? m : 'failed' }, { status: /cap|over/i.test(m) ? 507 : 500 }); }
}
