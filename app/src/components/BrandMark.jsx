'use client';
// BrandMark — the client's mark in the shell. `brand.logo` in os.yaml is copied to /brand/logo.<ext> and shown as is where a
// wordmark fits; in the icon rail and the collapsed sidebar the square `brand.icon` (or the generated monogram icon) is used;
// without a logo the mark is a monogram of `brand.name` on a brand tint. Pucho appears only in "Powered by" (design.powered_by).
// No remote asset, no webfont: the mark paints with the shell.
import { DESIGN } from '../config/design';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../utils/cn';

// `plain`: the mark sits on the page surface (public pages), not in the sidebar — the name takes the page's ink, never the
// nav's (on a dark sidebar the nav ink is white, and the name vanished on the white public header).
export default function BrandMark({ size = 32, wordmark = true, onDark = false, plain = false, sub = "", className = "" }) {
  const b = DESIGN.brand ?? {};
  const name = b.name || 'OS';
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return (
    <span className={cn('inline-flex items-center gap-2.5 min-w-0', className)} data-os-brand={b.logo ? 'logo' : 'monogram'}>
      {b.logo && !wordmark
        ? <img src={b.icon || '/brand/icon.svg'} alt={name} className="object-contain shrink-0 rounded-lg" style={{ width: size, height: size }} />   /* a square mark where a wordmark cannot fit (rail, collapsed sidebar) */
        : b.logo
        ? <span className="min-w-0 flex flex-col leading-none gap-1"><img src={b.logo} alt={name} className="object-contain shrink-0 self-start" style={{ height: sub ? size - 6 : size, maxWidth: size * 5.5 }} />{sub && <span className="text-[12px] font-medium uppercase tracking-wide truncate" style={{ color: onDark ? 'rgba(255,255,255,0.5)' : 'var(--nav-group)' }} data-os-portal-label>{sub}</span>}</span>
        : <span aria-hidden className="inline-flex items-center justify-center rounded-lg font-semibold shrink-0 select-none tracking-tight"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: onDark ? 'rgba(255,255,255,0.14)' : 'var(--brand-tint)', color: onDark ? '#fff' : 'var(--brand-ink)' }}>{initials}</span>}
      {wordmark && !b.logo && (
        <span className="min-w-0 flex flex-col leading-tight">
          {!b.logo && <span className="text-[14px] font-semibold tracking-tight truncate" style={{ color: onDark ? '#fff' : plain ? 'var(--ink)' : 'var(--nav-ink)' }}>{name}</span>}
          {sub && <span className="text-[12px] font-medium uppercase tracking-wide truncate" style={{ color: onDark ? 'rgba(255,255,255,0.5)' : 'var(--nav-group)' }} data-os-portal-label>{sub}</span>}
        </span>)}
    </span>
  );
}

/** v4.9 — the ONE global "Powered by Pucho.ai" badge (official branding guide): fixed bottom-right, rendered once per layout (dashboard, public, login).
 *  Self-hosted logo (/download.webp — the CSP is img-src 'self'). Kit rules win over the guide where they differ: the label is 12 px (not 10) in an
 *  ink token (>= 4.5:1), not slate-400. Dark glass, the narrow-screen pill, hide-while-a-dialog-is-open and print rules are in index.css
 *  (`[data-os-powered-by]`). `design.powered_by: false` renders nothing. */
export function PoweredBy({ className }) {
  const reduce = useReducedMotion();
  if (DESIGN.powered_by === false) return null;
  return (
    <div className={cn('fixed bottom-6 right-6 z-[9999] pointer-events-none select-none', className)} data-os-powered-by>
      <motion.div
        className="powered-pill flex items-center gap-2.5 px-4 py-2 bg-white/90 backdrop-blur-xl rounded-full shadow-[0_8px_32px_rgba(139,92,246,0.15)] border border-white/50"
        initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={reduce ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}>
        <span className="powered-label text-[12px] font-semibold uppercase tracking-widest text-ink-2">Powered by</span>
        <img src="/download.webp" alt="Pucho.ai" className="h-4 w-auto object-contain logo-adapt" />
      </motion.div>
    </div>
  );
}
