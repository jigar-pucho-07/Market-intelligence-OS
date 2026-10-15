# Pucho OS microanimations

Read when building custom UI or changing shared frontend behaviour. Generated apps receive this
file as `docs/microanimations.md`. Motion should clarify state, preserve spatial continuity, or
acknowledge an action. If it does none of these, omit it.

## Use the existing motion stack

Reuse `src/config/motion.js`: `D.INSTANT` 120ms, `D.QUICK` 200ms, `D.BASE` 280ms,
`D.SLOW` 420ms, and the `E` easing curves. Use CSS for simple colour/opacity feedback,
the installed `framer-motion` for component transitions, and existing GSAP hooks only when
they suit the task. Do not add another animation dependency or animate the same property
on the same element with two engines. Avoid `transition: all`.

Prefer opacity and small transforms. Do not continuously animate width, height, blur, box shadow,
large backgrounds, or table geometry. A brief content-sized disclosure may need layout work;
keep it local and check for jumps and clipping. Clean up timers, observers, and animations on
unmount; stop invisible or irrelevant work.

The current kernel contains historical exceptions to the timing rules: `useGsapMotion.js` has
longer default reveals/count-ups, and existing components do not all use the central presets.
These instructions do not claim those components have been migrated. For new custom UI, use
the timing below and explicitly override legacy hook defaults where necessary. Shared motion
changes belong in the kernel and require its existing regression gates.

## Interaction recipes

| Interaction | Behaviour | Timing / bounds |
|---|---|---|
| Button hover / focus | Subtle fill or border change; immediate visible focus | 120ms; no travel |
| Button press | Small tint/darken feedback; pending state reflects the request | 120ms; no bounce or delay before action |
| Navigation / tab selection | Existing selection indicator glides; label stays legible | About 200ms; zero overshoot |
| Page or newly revealed section | Fade and optional rise of 4–8px, once for meaningful arrival | 280ms; no replay for typing, filters, or polling |
| Small group entrance | Stagger only a few related items | 30ms per item, at most 120ms total delay |
| Menu / popover | Fade and at most 4–6px travel anchored to trigger | 200ms in, 120ms out |
| Modal / drawer | Calm overlay fade and short panel movement; preserve focus behaviour | 200–280ms in, 120–200ms out |
| Disclosure / accordion | Reveal nearby content without shifting the whole screen | 200ms; respect content height |
| New or updated record | Brief local fade/tint identifies the actual changed item | 200–280ms; stable keys and scroll position |
| Reordered list | Animate only user-relevant position changes in short lists | About 200ms; skip layout animation for large tables |
| Loading | Existing spinner or subtle skeleton only while a request is pending | Indeterminate loop is exempt from one-shot duration cap |
| Success / error | One subtle state transition plus persistent text where needed | 120–200ms; no confetti, shaking, or repeated pulses |
| KPI / chart | Show accurate values immediately; optional subtle initial reveal | Avoid count-from-zero by default; no looping or polling replay |

Avoid blanket row staggers, dramatic scale-ins, magnetic buttons, cursor effects, scroll hijacking,
parallax in work screens, continuously floating cards, animated gradients, and typewriter effects
on ordinary content. Do not add artificial loading or delay a completed response to finish an
animation. If a real stream exists, render arriving content naturally and preserve user scroll;
do not manufacture a stream for a completed answer.

Keep the existing `GLIDE` spring only for a settled, non-bouncing shared selection indicator.
Do not introduce elastic springs elsewhere. The existing `panel` preset's 0.99 scale is a small
anchoring cue, not permission for decorative scale effects. Its reduced-motion variant must not
travel or scale.

## Reduced motion and resilience

Read the preference reactively with `useReducedMotion` from the installed `framer-motion` in new
React components. `still()` and `prefersReducedMotion()` are existing snapshot helpers; they are
useful on render but do not by themselves subscribe to operating-system preference changes.

When reduced motion is requested:

- Render content in its final visible position immediately. Remove travel, scale, stagger, shared
  layout movement, count-up, shimmer, spinning, and repeated decorative motion.
- Keep a static labelled pending indicator and text updates so progress remains understandable.
- Set relevant transitions to zero; setting an animation duration alone does not remove delays.
- Add scoped `prefers-reduced-motion` CSS overrides for CSS effects in custom components. Do not
  assume React's motion preference handles CSS keyframes or independent GSAP timelines.
- Never leave content at `opacity: 0`, offscreen, or disabled because an animation did not run.

Example for a custom confirmation panel (call hooks unconditionally at component top level):

```jsx
import { motion, useReducedMotion } from 'framer-motion';
import { D, E } from '../config/motion';

export function ResultPanel({ children }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : D.QUICK, ease: E.OUT }}
    >
      {children}
    </motion.section>
  );
}
```

Keep the component mounted with stable keys across ordinary rerenders. Use `AnimatePresence` only
when exit motion is useful; remove exiting content from focus and interaction appropriately.
Do not key an entire page to fetched rows or a changing timestamp. Respect focus, text selection,
scroll position, and partially completed input while new data arrives.

## Verify behaviour

Exercise one representative flow: navigate, search/filter, open a record, submit an action, inspect
pending/success/error feedback, and close the panel. Repeat with reduced motion enabled, including
a preference change while the page is open. Confirm rapid repeated clicks cannot queue duplicate
mutations, stale animations do not hide new data, and focus returns correctly. Observe a refresh
cycle and a long list to catch repeated entrances or unnecessary layout work. Inspect a phone
viewport for clipping and touch interactions. Record what was actually observed; the existing
`ui_check.py` gate does not certify animation quality or all reduced-motion behaviour.

## Board drag (v3.2)

A dragged kanban card dims to 40 % and the column under the pointer tints with the brand soft colour and
a brand hairline; nothing scales, springs or follows the pointer with a shadow. After the drop the card
pulses softly while the write is in flight and the toast confirms the move. Under reduced motion the
tint and dim still happen (they are state, not motion); the pulse does not.
