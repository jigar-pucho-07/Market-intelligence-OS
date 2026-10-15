// /api/files/<id> — authorised serving of an upload stored in the database (D6, standards §19.4): signed-in people,
// or a workflow holding a short-lived signed link for this one file (lib/fileLinks.ts; the app mints it when it calls
// a wired flow). Anything that is not an image is an attachment.
import { currentUser } from '@/lib/auth';
import { readFile } from '@/lib/dal';
import { verifyFileSig } from '@/lib/fileLinks';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; if (!/^F-[0-9a-f]{16}$/.test(id)) return Response.json({ error: 'not found' }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const signed = q.has('sig') && verifyFileSig(id, q.get('exp'), q.get('sig'));
  if (!signed) { const user = await currentUser(); if (!user) return Response.json({ error: 'not signed in' }, { status: 401 }); }
  const f = await readFile(id); if (!f) return Response.json({ error: 'not found' }, { status: 404 });
  const inline = f.mime.startsWith('image/');
  return new Response(new Uint8Array(f.data), { headers: { 'Content-Type': f.mime, 'Content-Length': String(f.data.length), 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${f.name.replace(/[^\w.\-]/g, '_')}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': inline ? 'private, max-age=86400, immutable' : 'private, max-age=0' } });   // a stored picture never changes under its id — a page with 40 thumbnails must not refetch them on every render
}
