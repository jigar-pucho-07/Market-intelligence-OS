// next.config.js — standards/fullstack-build-standard.md §16 (CP Portal bundle: output 'standalone') and §19.6 (headers).
// Nothing here names a client value: the brand, the shell and the tokens come from os.yaml through the generated config.
const https = (process.env.APP_ORIGIN || '').startsWith('https://');

// §19.6 — the baseline CSP. 'unsafe-inline' for scripts is what Next.js hydration needs without a per-request nonce;
// styles are inline because antd and Tailwind inject them. No third-party origin anywhere: every font is bundled,
// every image is the client's own, and the browser never talks to Studio or the database (connect-src 'self').
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // HSTS only once the domain serves HTTPS (§19.1): APP_ORIGIN says whether it does.
  ...(https ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }] : []),
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=()' },   // microphone stays: the voice-note field records in the browser
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',          // CP Portal runs the uploaded bundle on its own Node: server.js + static, zero install (D3)
  poweredByHeader: false,
  reactStrictMode: true,
  // The native argon2 binding stays in node_modules for the standalone tracer; it is never bundled into the browser.
  serverExternalPackages: ['@node-rs/argon2', 'pg'],
  // skill_gate.py shares one node_modules across the seven worked examples through a symlink; Turbopack needs the
  // filesystem root widened to see it. A normal checkout never sets this.
  ...(process.env.TURBOPACK_ROOT ? { turbopack: { root: process.env.TURBOPACK_ROOT } } : {}),
  // The file-tracing root is this app, not wherever Next finds the nearest lockfile: a stray package-lock.json in the user's home
  // folder once made every build warn and traced the wrong tree (Haresh review, Oct 2026). The gate's shared node_modules widens
  // it through TURBOPACK_ROOT; a normal checkout never sets that.
  outputFileTracingRoot: process.env.TURBOPACK_ROOT || __dirname,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
