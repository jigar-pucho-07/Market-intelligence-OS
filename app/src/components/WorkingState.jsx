import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { D, E, still, prefersReducedMotion } from '../config/motion';
import { cn } from '../utils/cn';
import { humanize } from '../utils/labels';

/**
 * The moment a Pucho workflow is running.
 *
 * This is the signature interaction of the whole product and it used to be an antd spinner on a
 * button. A Pucho OS sells "the AI does this for you"; the two to twenty seconds where that is
 * literally happening is the only time the person watches the screen instead of using it. A bare
 * spinner says "wait". A named stage says "reading your enquiry", "drafting the quotation",
 * "saving to the sheet" — the same wait, spent understanding what they bought.
 *
 * Three honesty rules, because this component is easy to turn into a lie:
 *  1. Stages are the flow's REAL steps, declared in os.yaml or derived from what the action does.
 *     Never invent a stage the workflow does not perform.
 *  2. Progress is elapsed time, never a percentage. We do not know how long a model call takes,
 *     and a progress bar that jumps to 90% and waits is a fake.
 *  3. The last stage stays "in progress" until the call actually returns. Nothing is ticked off
 *     before it has happened.
 */

// Roughly how long each kind of step takes, used only to advance the highlight — never shown as
// a percentage, and never used to mark a step done.
const PACE = { read: 900, think: 2600, write: 1200, send: 1400 };

/** Derive the real stages from what the action declares. No flow → no AI → no theatre. */
export function stagesFor(spec = {}) {
  if (Array.isArray(spec.working) && spec.working.length) return spec.working;
  const out = [];
  if (spec.lookup) out.push({ label: 'Reading the record', kind: 'read' });
  if (spec.flow || spec.prompt) out.push({ label: 'Asking the model', kind: 'think' });
  if (spec.sends) out.push({ label: 'Sending', kind: 'send' });
  out.push({ label: spec.entity ? `Saving to ${humanize(spec.entity)}` : 'Saving', kind: 'write' });
  return out;
}

export default function WorkingState({ spec = {}, active, className }) {
  const stages = stagesFor(spec).map((s) => (typeof s === 'string' ? { label: s, kind: 'think' } : s));
  const [at, setAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) { setAt(0); setElapsed(0); return; }
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    // advance the highlight, but never past the last stage — that one ends when the call does
    let i = 0;
    const timers = [];
    const step = () => {
      if (i >= stages.length - 1) return;
      timers.push(setTimeout(() => { i += 1; setAt(i); step(); }, PACE[stages[i].kind] ?? 1200));
    };
    step();
    return () => { clearInterval(tick); timers.forEach(clearTimeout); };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;
  const reduced = prefersReducedMotion();

  return (
    <motion.div
      {...still({
        initial: { opacity: 0, height: 0 },
        animate: { opacity: 1, height: 'auto', transition: { duration: D.QUICK, ease: E.OUT } },
        exit: { opacity: 0, height: 0, transition: { duration: D.INSTANT } },
      })}
      className={cn('overflow-hidden', className)}
      // the wait is announced once, not re-read on every stage change
      role="status"
      aria-live="polite"
      aria-label="Working"
      data-os-working
    >
      <div className="rounded-xl border border-[color:var(--hair-6)] bg-surface-2 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] font-medium text-ink">Working</span>
          {/* elapsed, not progress — we genuinely do not know how long the model will take */}
          <span className="text-[11px] text-ink-3 tabular">{elapsed}s</span>
        </div>

        <ul className="space-y-2">
          {stages.map((s, i) => {
            const done = i < at;
            const now = i === at;
            return (
              <li key={s.label} className="flex items-center gap-2.5">
                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                  <AnimatePresence mode="wait" initial={false}>
                    {done ? (
                      <motion.span
                        key="done"
                        {...still({ initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } })}
                        transition={{ duration: D.INSTANT }}
                      >
                        <Check className="w-3.5 h-3.5 text-ok-text" strokeWidth={2.5} />
                      </motion.span>
                    ) : now ? (
                      <Loader2
                        key="now"
                        className={cn('w-3.5 h-3.5 text-ink', !reduced && 'animate-spin')}
                        strokeWidth={2}
                      />
                    ) : (
                      <span key="wait" className="w-1.5 h-1.5 rounded-full bg-black/[0.15]" />
                    )}
                  </AnimatePresence>
                </span>
                <span className={cn('text-[13px] leading-tight', now ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-4')}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>

        {/* An indeterminate bar: it says "still going", it does not claim to know how far. */}
        {!reduced && (
          <div className="mt-3 h-[3px] w-full rounded-full bg-black/[0.06] overflow-hidden">
            <motion.div
              className="h-full w-1/3 rounded-full bg-ink/25"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.4, ease: E.STANDARD, repeat: Infinity }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
