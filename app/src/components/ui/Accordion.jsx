'use client';
// Accordion — v4.9 atom (oct-new-ui "Accordion"): collapsible sections (detail-page groups, SOP steps, FAQs).
// FROZEN API: <Accordion items={[{ key, title, content, defaultOpen? }]} multiple?={false} className? />
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';

export default function Accordion({ items = [], multiple = false, className }) {
  const [open, setOpen] = useState(() => new Set(items.filter((i) => i.defaultOpen).map((i) => i.key)));
  const toggle = (k) => setOpen((s) => { const n = new Set(multiple ? s : []); if (s.has(k)) n.delete(k); else n.add(k); return n; });
  return (
    <div className={cn('accordion', className)}>
      {items.map((it) => {
        const isOpen = open.has(it.key);
        const id = `acc-${String(it.key).replace(/\W/g, '')}`;
        return (
          <div key={it.key} className={cn('accordion__item', isOpen && 'is-open')}>
            <button type="button" className="accordion__trigger" aria-expanded={isOpen} aria-controls={id} onClick={() => toggle(it.key)}>
              <span>{it.title}</span><ChevronDown size={16} aria-hidden="true" className="accordion__chevron" />
            </button>
            {isOpen && <div id={id} role="region" className="accordion__panel">{it.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
