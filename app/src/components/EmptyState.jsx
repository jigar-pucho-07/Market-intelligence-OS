import { cn } from '../utils/cn';
import { Inbox } from 'lucide-react';
import { useT } from '../i18n';

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}) {
  const t = useT();
  return (
    <div className={cn('flex flex-col items-center justify-center p-10 text-center rounded-xl border border-dashed border-[color:var(--line)]', className)} data-testid="empty-state">
      <div className="w-12 h-12 bg-black/[0.04] rounded-full flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-ink-3" strokeWidth={1.5} />
      </div>
      <h3 className="text-[15px] font-semibold text-ink mb-1">{typeof title === 'string' ? t(title) : title}</h3>
      {description && <p className="text-[13px] text-ink-3 max-w-sm">{typeof description === 'string' ? t(description) : description}</p>}
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-4">
          {typeof action.label === 'string' ? t(action.label) : action.label}
        </button>
      )}
    </div>
  );
}
