// /api/personas — the demo persona picker on the login page, for the client click-through (step 5) ONLY. It answers only
// when the server runs with DEMO_LOGINS=true (a runtime flag on a demo deployment, never on a client's), from db/seed/users.json
// on disk — so no persona password is ever compiled into the bundle (security_scan F3 proves it).
// It lists names, roles and emails — never a password (audit S3, Oct 2026). Picking a persona calls the Server Action
// `signInAsPersona`, which creates the session on the server and exists only while DEMO_LOGINS=true.
import fs from 'node:fs'; import path from 'node:path';
import { demoLogins } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!demoLogins()) return Response.json({ personas: [] });   // 200 and empty: a client deployment has nothing to list, and nothing to log
  try {
    const users = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'db', 'seed', 'users.json'), 'utf8')) as { role: string; name: string; email: string }[];
    return Response.json({ personas: users.map((u) => ({ key: u.role, label: `${u.name} (${u.role})`, email: u.email })) });
  } catch { return Response.json({ personas: [] }); }
}
