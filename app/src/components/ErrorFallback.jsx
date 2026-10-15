import { AlertTriangle } from 'lucide-react';
import { useT } from '../i18n';

// The error boundary's card (a section of a page failed, not the whole app): plain words, one way forward, and the
// technical message kept out of sight on hover for whoever has to report it. v4.9.
export default function ErrorFallback({ error, resetErrorBoundary }) {
  const t = useT();
  return (
    <div role="alert" data-testid="error-fallback" className="card border-intent-danger-border bg-intent-danger-bg flex flex-col items-center justify-center text-center p-8 min-h-[200px]">
      <AlertTriangle className="w-8 h-8 text-intent-danger-text mb-3" strokeWidth={1.5} aria-hidden />
      <h3 className="text-sm font-semibold text-intent-danger-text">{t('Something went wrong')}</h3>
      <p className="text-xs text-intent-danger-text/70 mt-1 mb-4 max-w-[250px]" title={error?.message || undefined}>
        {t('This part of the page could not load. Nothing you saved was lost — try again.')}
      </p>
      <button type="button" onClick={resetErrorBoundary} className="btn-secondary text-intent-danger-text text-xs">
        {t('Try again')}
      </button>
    </div>
  );
}
