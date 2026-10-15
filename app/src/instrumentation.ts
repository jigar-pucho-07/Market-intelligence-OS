// src/instrumentation.ts — runs once per server start (standards §13.4): say what was resolved, never a secret.
// The Node-only part lives in instrumentation-node.ts so the edge bundle never sees `pg`.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startupLog } = await import('./instrumentation-node');
    await startupLog();
  }
}
