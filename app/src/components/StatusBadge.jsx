import { cn } from '../utils/cn';
import { toneOf } from './ui/primitives';
import { stageStyle } from '../module/stage';
import { useT } from '../i18n';

const statusConfig = {
  Critical: 'badge-danger',
  High: 'badge-danger',
  Blocked: 'badge-danger',
  Overdue: 'badge-danger',
  'Out of Stock': 'badge-danger',
  Failed: 'badge-danger',
  Rejected: 'badge-danger',
  Fail: 'badge-danger',
  Medium: 'badge-warning',
  'In Progress': 'badge-warning',
  Processing: 'badge-warning',
  Pending: 'badge-warning',
  'Soft Overdue': 'badge-warning',
  'Carried Forward': 'badge-warning',
  Hold: 'badge-warning',
  'Due Soon': 'badge-warning',
  queued: 'badge-warning',
  Low: 'badge-neutral',
  Waiting: 'badge-neutral',
  Inactive: 'badge-neutral',
  Cancelled: 'badge-neutral',
  Draft: 'badge-neutral',
  Closed: 'badge-neutral',
  idle: 'badge-neutral',
  Open: 'badge-info',
  Approved: 'badge-info',
  Scheduled: 'badge-info',
  Ready: 'badge-info',
  Shipped: 'badge-info',
  'In Transit': 'badge-info',
  Completed: 'badge-success',
  OK: 'badge-success',
  Active: 'badge-success',
  Matched: 'badge-success',
  Won: 'badge-success',
  Delivered: 'badge-success',
  Pass: 'badge-success',
  Resolved: 'badge-success',
  'Auto-Responded': 'badge-success',
  Paid: 'badge-success',
  running: 'badge-success',
  scheduled: 'badge-info',
  Verified: 'badge-success', Submitted: 'badge-success', Released: 'badge-success', Done: 'badge-success', Reviewed: 'badge-success',
  Urgent: 'badge-danger', Lost: 'badge-danger', 'Awaiting Verification': 'badge-warning', 'Follow-up': 'badge-warning', Assigned: 'badge-info', New: 'badge-info', Contacted: 'badge-info', Qualified: 'badge-info', Quoted: 'badge-info', Negotiation: 'badge-warning', 'Req. Confirmed': 'badge-info',
};

// A boolean column ("true"/"false", "yes"/"no") reads as a word, never as the raw literal.
const BOOL = { true: 'Active', false: 'Inactive', yes: 'Yes', no: 'No' };
export default function StatusBadge({ status, size = 'default' }) {
  const t = useT();
  const raw = String(status ?? '').trim();
  const normalizedStatus = BOOL[raw.toLowerCase()] ?? (raw || 'Unknown');
  const badgeClass = statusConfig[normalizedStatus] || { ok: 'badge-success', warn: 'badge-warning', bad: 'badge-danger', info: 'badge-info' }[toneOf(normalizedStatus)] || 'badge-neutral';

  const sizeClasses = {
    small: 'text-[12px] px-2 py-0.5',
    default: 'text-[12px] px-2.5 py-1',
    large: 'text-[13px] px-3 py-1.5',
  };
  // A pipeline stage takes its colour from the ramp (M3); Won / Lost / Draft keep their semantic colour. v4.9: the 12 % tint sits on --surface (not literal white) so the chip reads in dark too.
  const ramp = stageStyle(normalizedStatus);
  return (
    <span className={cn('badge', ramp ? '' : badgeClass, sizeClasses[size] || sizeClasses.default)} style={ramp ? { ...ramp, background: ramp.background === 'transparent' ? 'transparent' : `color-mix(in srgb, ${ramp.color} 12%, var(--surface))` } : undefined} data-os-stage={ramp ? normalizedStatus : undefined}>
      {t(normalizedStatus)}
    </span>
  );
}
