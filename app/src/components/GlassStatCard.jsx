import { cn } from '../utils/cn';
import { IconDisc, Progress, toneOf } from './ui/primitives';

/**
 * The KPI card. One per metric, identical on every page.
 *
 * Restraint is the point. The card is a white rectangle with a hairline; the number is the largest
 * thing on it; colour appears only where a state needs attention. Three optional extras, each
 * declared in os.yaml and each real data: a `sub` line ("7 pending today"), a `progress` fraction
 * (done / total) and a `tone` that puts the icon on a tinted disc — for a card whose meaning is a
 * status (Overdue, Completed), never as decoration across a whole row.
 */
const STATUS_TEXT = { Good: 'text-ok-text', Warning: 'text-warn-text', Critical: 'text-bad-text' };

export default function GlassStatCard({
  icon: Icon, label, value, alert, highlight, progress, subtitle, subLabel, status, large, tone, selected, onClick, metric, link,
}) {
  // No count-up: a number that is still moving when the eye lands on it reads as a different number on every visit (C4).
  const semantic = toneOf(label);
  const sub = subtitle ?? subLabel;
  // A zero is not a problem. Only tint the number when the state it names is actually present.
  const live = semantic !== 'neutral' && semantic !== 'info' && Number(value) !== 0 && value !== '0';
  const textTone = { ok: 'text-ok-text', warn: 'text-warn-text', bad: 'text-bad-text' }[semantic];
  const disc = tone === 'auto' ? (live ? semantic : 'neutral') : tone;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? (selected ? 'true' : 'false') : undefined}
      data-os-metric={metric}
      data-os-kpi-link={link ?? undefined}
      data-os-kpi-label={label}
      title={link ? `Open ${label}` : undefined}
      className={cn('card group relative h-full', onClick && 'card-clickable', highlight && 'border-primary-300', selected && 'card-selected')}
    >
      <div className="flex flex-col h-full p-4">
        {/* Label row. The icon is a quiet wayfinding mark unless a tone is declared. */}
        <div className="flex items-center gap-2.5 min-h-[22px]">
          {Icon && (disc ? <IconDisc icon={Icon} tone={disc} size={32} /> : <Icon className="w-4 h-4 text-ink-3 shrink-0" strokeWidth={1.75} />)}
          <p title={label} className="text-[12px] font-medium text-ink-2 leading-[1.2] flex-1 min-w-0 line-clamp-2 break-words">{label}</p>
          {live && alert && !disc && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[semantic])} />}
        </div>

        {/* The number. Largest thing on the card, tabular so it never shifts while counting. */}
        <h3
          data-kpi-value={String(value ?? 0)}
          title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          className={cn('font-semibold tracking-[-0.022em] leading-none mt-3 truncate tabular', large ? 'text-[34px]' : 'text-[28px]', live && alert ? textTone : 'text-ink')}
        >
          {typeof value === 'number' ? value.toLocaleString('en-IN') : (value ?? 0)}
        </h3>

        {(sub || status) && (
          <p title={[sub, status].filter(Boolean).join(' · ')} className="text-[12px] text-ink-3 mt-1.5 leading-[1.3] line-clamp-2 break-words">
            {sub}{sub && status ? ' · ' : ''}
            {status && <span className={cn('font-medium', STATUS_TEXT[status] || 'text-ink-3')}>{status}</span>}
          </p>
        )}

        {progress && (
          <div className="mt-auto pt-3">
            <Progress compact value={progress.value} of={progress.of} pct={progress.pct} tone={progress.tone ?? 'brand'} />
          </div>
        )}
      </div>
    </div>
  );
}
