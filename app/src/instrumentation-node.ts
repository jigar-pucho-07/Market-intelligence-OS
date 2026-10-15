import { dbConfig, dbConfigError, describeDb } from '@/lib/db';
import { wiring } from '@/lib/flows';
import { inboundOpen, demoMode } from '@/lib/auth';

export async function startupLog() {
  // S4 — demo logins (listed personas, password-less persona sign-in) must never meet a live database. `true` is for a local
  // or demo database; with the portal's DB_* block present the server refuses to start. `portal-demo` is the deliberate,
  // logged exception for a demo deployment on CP Portal (step 5), demo data only.
  const demo = demoMode();
  if (demo === 'true' && process.env.DB_HOST) {
    console.error('REFUSING TO START: DEMO_LOGINS=true with a DB_HOST (portal) database. Unset DEMO_LOGINS for a client deployment, or set DEMO_LOGINS=portal-demo for a demo deployment that holds demo data only.');
    process.exit(3);
  }
  if (demo) console.warn(`DEMO LOGINS ON (${demo}): the login page lists the seeded personas and signs them in without a password. Never on a client's deployment.`);
  const w = wiring();
  console.log(`Database: ${dbConfigError ? 'INVALID — ' + dbConfigError : describeDb(dbConfig)}`);
  console.log(`Workflows wired: ${w.wired}/${w.total}${w.unwired.length ? ' — SIMULATED: ' + w.unwired.join(', ') : ''} · inbound: ${inboundOpen() ? 'open to flows with an INBOUND_TOKEN*' : 'closed (no INBOUND_TOKEN set)'}`);
  if (dbConfig.ssl && !process.env.DB_SSL_CA) console.warn('DB TLS NOT VERIFIED — set DB_SSL_CA (standards §19.1); release blocker in production');
  if (!process.env.AUTH_PEPPER) console.warn('AUTH_PEPPER unset — one-time codes are hashed with an empty pepper; set it before go-live');
}
