// Stepper — multi-step wizard (payroll run, new joiner, client onboarding). Each step has fields or a
// review; one payload submits to flow.action. The header is the kernel's own: numbered discs with a
// title and an optional `sub` line, the current step in the brand colour, finished steps ticked.
// A step may carry `icon` and `desc` to head its section ("Business entity information — enter legal
// entity details and statutory numbers").
import { useState } from 'react';
import { Button } from 'antd';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import Fields, { missingFields, missingText, startValue, useRelativeDefaults } from '../Fields';
import { useFieldErrors, focusField } from '../fieldErrors';
import { useT } from '../../i18n';
import { useAuth } from '../../context/AuthContext';
import { labelOf } from '../../utils/labels';
import { runAction } from '../../utils/api';
import { CARD, SECTION_TITLE } from '../Charts';
import { icon } from '../Kpis';
import { cn } from '../../utils/cn';

export function StepHeader({ steps, current }) {
  return (
    <ol className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1" data-os-steps>
      {steps.map((s, i) => { const done = i < current; const now = i === current; return (
        <li key={i} aria-current={now ? 'step' : undefined} className={cn('flex items-center gap-3 min-w-0 shrink-0 rounded-[var(--r-10)] px-3 py-2', now && 'bg-primary-50 border border-primary-100', !now && 'border border-transparent')}>
          <span className={cn('w-7 h-7 rounded-full inline-flex items-center justify-center text-[12px] font-semibold shrink-0', done ? 'bg-primary-500 text-white' : now ? 'bg-primary-500 text-white' : 'bg-black/[0.05] text-ink-3')}>{done ? <Check className="w-3.5 h-3.5" /> : i + 1}</span>
          <span className="min-w-0">
            <span className={cn('block text-[13px] font-semibold leading-tight truncate', now ? 'text-primary-700' : done ? 'text-ink' : 'text-ink-3')}>{s.title}</span>
            {s.sub && <span className={cn('block text-[11px] truncate', now ? 'text-primary-600' : 'text-ink-3')}>{s.sub}</span>}
          </span>
        </li>); })}
    </ol>
  );
}

export default function Stepper({ block, data, reload, entity }) {
  const t = useT(); const { user } = useAuth(); const fe = useFieldErrors();
  const [cur, setCur] = useState(0);
  const [values, setValues] = useState(() => Object.fromEntries(block.steps.flatMap((s) => (s.fields ?? []).map((f) => [f.key, startValue(f, entity, user, { defer: true }) ?? '']))));
  useRelativeDefaults(block.steps.flatMap((s) => s.fields ?? []), entity, setValues);   // today / tomorrow defaults fill after mount (server and browser clocks differ)
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(null);
  const step = block.steps[cur]; const last = cur === block.steps.length - 1;
  const next = () => { const miss = missingFields(step.fields, values); if (miss.length) { focusField(miss[0].key); return toast.error(missingText(miss, t)); } setCur(cur + 1); };
  const submit = async () => {
    fe.reset(); setBusy(true);
    try { const res = await runAction(block, values); toast.success(block.success ?? 'Submitted'); setDone(res); reload?.(); }
    catch (e) {
      if (e.code === 'NOT_WIRED') { toast.error(t('This workflow is not connected yet')); return; }
      // a field the server refused may sit on an earlier step: go back to the first step that holds one, then focus it
      const { matched, rest } = fe.apply(e, block.steps.flatMap((s) => s.fields ?? []));
      if (matched.length) { const at = block.steps.findIndex((s) => (s.fields ?? []).some((f) => f.key === matched[0])); if (at >= 0 && at !== cur) { setCur(at); setTimeout(() => focusField(matched[0]), 80); } }
      if (rest) toast.error(rest);
    } finally { setBusy(false); }
  };
  const idKey = done && Object.keys(done).find((k) => k.endsWith('_ID') || k.endsWith('_No'));
  const SI = step.icon ? icon(step.icon) : null;
  return (
    <div className={`${CARD} p-5 sm:p-6`} data-os-stepper>
      {block.title && <h3 className={`${SECTION_TITLE} mb-4`}>{block.title}</h3>}
      <StepHeader steps={block.steps} current={cur} />
      {/* ux-laws: goal gradient + Zeigarnik — say how far along and how much is left */}
      {!done && (
        <div className="flex items-center gap-3 mt-3">
          <span className="text-[12px] text-ink-3 tabular shrink-0" data-os-step-count>Step {cur + 1} of {block.steps.length}</span>
          <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={block.steps.length} aria-valuenow={cur + 1} className="flex-1 h-1 rounded-full bg-black/[0.06] overflow-hidden">
            <div className="h-full bg-primary-500 transition-[width] duration-200" style={{ width: `${((cur + 1) / block.steps.length) * 100}%` }} />
          </div>
        </div>
      )}
      {done ? (
        <div className="text-center py-8">
          <span className="inline-flex w-12 h-12 rounded-full bg-ok-soft text-ok-text items-center justify-center mb-3"><Check className="w-6 h-6" /></span>
          <p className="font-semibold text-ink">{block.done ?? 'Done.'}</p>
          {idKey && <p className="text-[13px] text-ink-2 tabular mt-1">{done[idKey]}</p>}
          <Button className="mt-4" onClick={() => { setDone(null); setCur(0); }}>Start another</Button>
        </div>
      ) : (
        <div className="os-form mt-5" data-os-form>
          {(step.desc || SI) && (
            <div className="flex items-start gap-3 mb-4">
              {SI && <span className="w-9 h-9 rounded-full bg-black/[0.04] text-ink-2 inline-flex items-center justify-center shrink-0"><SI className="w-4 h-4" /></span>}
              <div><p className="text-[15px] font-semibold text-ink">{step.heading ?? step.title}</p>{step.desc && <p className="text-[13px] text-ink-3">{step.desc}</p>}</div>
            </div>
          )}
          {step.review ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg bg-surface-2 border border-[color:var(--hair-5)] p-4">{block.steps.flatMap((s) => s.fields ?? []).map((f) => <div key={f.key} className="min-w-0"><dt className="text-[12px] text-ink-3">{labelOf(t, f.key, f.label)}</dt><dd className="text-[14px] font-medium text-ink break-words">{String(values[f.key] || '—')}</dd></div>)}</dl>
          ) : <Fields fields={step.fields} values={values} setValues={setValues} data={data} entity={entity} columns={step.columns ?? 1} errors={fe.errors} onClearError={fe.clear} />}
          {step.help && <p className="text-[12px] text-ink-3 mt-3">{step.help}</p>}
          <div className="flex justify-between mt-6 pt-4 border-t border-[color:var(--hair-5)]">
            <Button disabled={cur === 0} onClick={() => setCur(cur - 1)}>{t('Back')}</Button>
            {last ? <Button type="primary" loading={busy} onClick={submit}>{t(block.submit ?? 'Submit')}</Button> : <Button type="primary" onClick={next}>{t(step.next ?? 'Next step')}</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
