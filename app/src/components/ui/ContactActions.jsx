// ContactActions — Call · WhatsApp · Email for a record, from the entity's `contact:` declaration:
//   contact: { phone: Phone, whatsapp: Phone, email: Email }
// Real links (tel:, wa.me, Gmail compose), so on a phone a tap dials. `onLog` (optional) opens the log modal after a
// tap so the rep records what happened — the audit's H2: a rep should never copy a number by hand.
import { Phone, MessageCircle, Mail } from 'lucide-react';
import { cn } from '../../utils/cn';

export const digits = (v) => String(v ?? '').replace(/[^\d+]/g, '');
/** 24 Oct 2026: the number to dial, with its country code — "45436 36435" → +914543636435, "098250 12345" → +919825012345,
 *  "919825012345" → +919825012345; a number already starting with + is kept. Without it a phone app or Phone Link on a PC
 *  dials the wrong country (and wa.me opens no chat). The OS is India-first, so a bare 10-digit number is Indian. */
export function dialable(v) {
  const d = digits(v); if (d.startsWith('+')) return d;
  if (/^0\d{10}$/.test(d)) return `+91${d.slice(1)}`;
  if (/^\d{10}$/.test(d)) return `+91${d}`;
  if (/^91\d{10}$/.test(d)) return `+${d}`;
  return d;
}
/** +919870011132 → +91 98700 11132 (Indian mobile grouping); other lengths are returned as typed. */
export function formatPhone(v) {
  const d = digits(v); const m = d.match(/^\+?91(\d{5})(\d{5})$/); if (m) return `+91 ${m[1]} ${m[2]}`;
  const n = d.match(/^(\d{5})(\d{5})$/); return n ? `${n[1]} ${n[2]}` : String(v ?? '');
}

/** Gmail's compose window, To filled: https://mail.google.com/mail/?view=cm&fs=1&to=a%40b.in */
export const gmailCompose = (email) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(String(email).trim())}`;

export function contactLinks(row, ent) {
  const c = ent?.contact; if (!c || !row) return [];
  const out = [];
  const phone = c.phone && row[c.phone]; const wa = c.whatsapp && row[c.whatsapp]; const email = c.email && row[c.email];
  if (phone) out.push({ key: 'call', label: 'Call', icon: Phone, href: `tel:${dialable(phone)}`, title: formatPhone(dialable(phone)) });
  if (wa) out.push({ key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/${dialable(wa).replace(/^\+/, '')}`, title: formatPhone(dialable(wa)), external: true });
  // 24 Oct 2026: Email opens Gmail's compose window in a new tab with the address in To (a mailto: link only opened the
  // browser's default handler — nothing, on a PC without a mail app).
  if (email) out.push({ key: 'email', label: 'Email', icon: Mail, href: gmailCompose(email), title: String(email), external: true });
  return out;
}

export default function ContactActions({ row, ent, size = 'md', primary = 'call', onLog, className, labels = true }) {
  const links = contactLinks(row, ent);
  if (!links.length) return null;
  const h = size === 'sm' ? 'h-8 px-2.5 text-[12px]' : 'h-9 px-3 text-[13px]';
  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', className)} data-os-contact onClick={(e) => e.stopPropagation()}>
      {links.map((l) => {
        const I = l.icon; const isPrimary = l.key === primary;
        return (
          <a key={l.key} href={l.href} target={l.external ? '_blank' : undefined} rel={l.external ? 'noreferrer' : undefined} title={l.title} aria-label={`${l.label} ${l.title}`} data-os-contact-action={l.key}
            onClick={() => onLog?.(l.key, row)}
            className={cn('inline-flex items-center gap-1.5 rounded-[var(--r-8)] font-medium transition-colors', h, isPrimary ? 'bg-primary-500 text-white hover:bg-primary-600' : 'border border-surface-border text-ink-2 hover:bg-black/[0.03] hover:text-ink')}>
            <I className="w-3.5 h-3.5" />{labels && <span>{l.label}</span>}
          </a>
        );
      })}
    </div>
  );
}
