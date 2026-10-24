// /api/out/<entity>/<id>?col=<Column> — 24 Oct 2026: open the web address stored on a record (the details grid's link button).
// Signed-in people only; the row is read with the person's own role and scope (getRow), the column must be one of the entity's
// and hold an http(s) address, so this redirects only to a link already on a record the person may see — never to a URL from
// the query string. A Google News RSS link is resolved to the publisher's page first (lib/outLink.ts).
import { currentUser } from '@/lib/auth';
import { getRow } from '@/lib/dal';
import { ENTITIES } from '@/config/os.config';
import { webUrl, resolveOutbound } from '@/lib/outLink';
export const dynamic = 'force-dynamic';
export async function GET(req: Request, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const user = await currentUser(); if (!user) return Response.json({ error: 'not signed in' }, { status: 401 });
  const { entity, id } = await ctx.params; const e = (ENTITIES as any)[entity];
  const colName = new URL(req.url).searchParams.get('col') || '';
  if (!e || !e.columns.includes(colName) || id.length > 200) return Response.json({ error: 'not found' }, { status: 404 });
  const row = await getRow({ kind: 'user', user }, entity, id).catch(() => null);
  const link = row && webUrl(row[colName]); if (!link) return Response.json({ error: 'not found' }, { status: 404 });
  const to = webUrl(await resolveOutbound(link.href)) ?? link;
  return new Response(null, { status: 302, headers: { Location: to.href, 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
}
