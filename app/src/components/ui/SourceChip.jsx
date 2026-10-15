'use client';
// SourceChip — v4.9 atom (oct-new-ui "Source chip"): where a record came from (AI call, WhatsApp, web form, manual…).
// FROZEN API (other modules import it): <SourceChip source="whatsapp" label? size?="sm"|"md" className? />
import * as Icons from 'lucide-react';
import { cn } from '../../utils/cn';

const MAP = {
  whatsapp: ['MessageCircle', 'WhatsApp'], ai_call: ['PhoneCall', 'AI call'], call: ['Phone', 'Call'], email: ['Mail', 'Email'],
  web: ['Globe', 'Web form'], form: ['FileText', 'Form'], manual: ['PenLine', 'Manual'], import: ['Upload', 'Import'], flow: ['Workflow', 'Workflow'],
};
export default function SourceChip({ source, label, size = 'sm', className }) {
  const key = String(source || '').toLowerCase().replace(/[\s-]+/g, '_');
  const [icon, text] = MAP[key] || ['Dot', label || source || '—'];
  const Icon = Icons[icon] || Icons.Dot;
  return (
    <span className={cn('source-chip', `source-chip--${size}`, className)} data-source={key}>
      <Icon size={size === 'md' ? 14 : 12} aria-hidden="true" />
      <span>{label || text}</span>
    </span>
  );
}
