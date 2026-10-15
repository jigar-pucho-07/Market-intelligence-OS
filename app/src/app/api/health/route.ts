// readiness — can it serve data? Two answers from one route (audit S1, Oct 2026):
//   anyone        { ok }                — enough for a load balancer, the gate's "did it start", a status page;
//                                        503 { ok:false } when the database is not reachable, with no detail.
//   administrator { ok, database, workflows, inbound } — the database it is pointed at (host · name · user, never a
//                                        password), how many flows are wired and whether inbound is open.
// Everyone else used to get the second answer, including a signed-out visitor; a Purchase user could read the database
// host from Settings. Operational detail is for the person who can act on it.
import { pool, dbConfig, dbConfigError, describeDb } from '@/lib/db';
import { wiring } from '@/lib/flows';
import { currentUser, inboundOpen, demoMode } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (dbConfigError) return Response.json({ ok: false }, { status: 503 });
  let reachable = true;
  try { await pool.query('SELECT 1'); } catch { reachable = false; }
  const user = reachable ? await currentUser().catch(() => null) : null;
  if (!reachable) return Response.json({ ok: false }, { status: 503 });
  if (!user || user.role !== 'admin') return Response.json({ ok: true });
  const w = wiring();
  return Response.json({ ok: true, database: describeDb(dbConfig), workflows: { wired: w.wired, total: w.total, unwired: w.unwired }, inbound: inboundOpen(), demo_logins: demoMode() });
}
