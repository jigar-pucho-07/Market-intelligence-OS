import { useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Staggered rise+fade of the container's direct children.
 * Re-runs whenever `deps` change (route, data, page, sort...).
 */
export function useRevealStagger(deps = [], options = {}) {
  const ref = useRef(null);
  const { y = 18, stagger = 0.06, duration = 0.55, selector = ':scope > *' } = options;

  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      const targets = ref.current.querySelectorAll(selector);
      if (!targets.length) return;
      gsap.fromTo(
        targets,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          stagger,
          ease: 'power3.out',
          overwrite: 'auto',
          clearProps: 'transform,opacity,visibility',
          onInterrupt: () => gsap.set(targets, { clearProps: 'all' }),
        }
      );
    },
    { scope: ref, dependencies: deps }
  );

  return ref;
}

/**
 * Count-up animation for a numeric value. Integers never flicker decimals.
 * Returns a ref to put on the element whose textContent shows the number.
 */
export function useCountUp(value, deps = [], options = {}) {
  const ref = useRef(null);
  const { duration = 1, formatter } = options;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      const numeric = typeof value === 'number' ? value : parseFloat(value);
      if (isNaN(numeric)) {
        el.textContent = value ?? '';
        return;
      }
      if (prefersReducedMotion()) {
        el.textContent = formatter ? formatter(numeric) : numeric.toLocaleString('en-IN');
        return;
      }
      const isInt = Number.isInteger(numeric);
      const state = { v: 0 };
      gsap.to(state, {
        v: numeric,
        duration,
        ease: 'power2.out',
        onUpdate: () => {
          const current = isInt ? Math.round(state.v) : Math.round(state.v * 10) / 10;
          el.textContent = formatter ? formatter(current) : current.toLocaleString('en-IN');
        },
      });
    },
    { dependencies: [value, ...deps] }
  );

  return ref;
}

/**
 * One-shot slide+fade entrance for a single element.
 */
export function useEntrance(deps = [], options = {}) {
  const ref = useRef(null);
  const { y = 14, x = 0, duration = 0.5, delay = 0 } = options;

  useGSAP(
    () => {
      if (prefersReducedMotion() || !ref.current) return;
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, y, x },
        {
          autoAlpha: 1,
          y: 0,
          x: 0,
          duration,
          delay,
          ease: 'power3.out',
          overwrite: 'auto',
          clearProps: 'transform,opacity,visibility',
        }
      );
    },
    { scope: ref, dependencies: deps }
  );

  return ref;
}
