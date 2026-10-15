// liveness — is this process answering HTTP? Touches nothing else. Orchestrators and CP Portal point here (standards §14.3).
export const dynamic = 'force-dynamic';
export async function GET() { return Response.json({ ok: true }); }
