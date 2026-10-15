'use client';
// src/lib/router.jsx — the kernel's routing vocabulary (Link with `to`, useLocation, useNavigate, useParams,
// useSearchParams, Navigate) over Next.js's App Router. Routes stay data (os.yaml → src/config/pages.js); the named
// params of a page's route pattern come from the server through RouteContext, so `useParams()` reads `:id` as before.
import { createContext, useContext, useEffect, useMemo } from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';

export const RouteContext = createContext({ params: {} });

export function Link({ to, href, replace, state, prefetch = false, ...rest }) {   // eslint-disable-line no-unused-vars
  return <NextLink href={to ?? href ?? '#'} replace={replace} prefetch={prefetch} {...rest} />;
}

export function useLocation() {
  const pathname = usePathname(); const sp = useNextSearchParams();
  const search = sp?.toString() ? `?${sp.toString()}` : '';
  return useMemo(() => ({ pathname, search, hash: '', state: null, key: pathname + search }), [pathname, search]);
}

export function useNavigate() {
  const router = useRouter();
  return (to, opts = {}) => {
    if (typeof to === 'number') { if (to < 0) router.back(); else router.forward(); return; }
    if (opts.replace) router.replace(to); else router.push(to);
  };
}

export function useParams() { return useContext(RouteContext).params ?? {}; }

export function useSearchParams() {
  const sp = useNextSearchParams(); const router = useRouter(); const pathname = usePathname();
  const set = (next, opts = {}) => {
    const q = next instanceof URLSearchParams ? next : new URLSearchParams(typeof next === 'function' ? next(new URLSearchParams(sp?.toString())) : next);
    const url = q.toString() ? `${pathname}?${q}` : pathname;
    if (opts.replace === false) router.push(url, { scroll: false }); else router.replace(url, { scroll: false });
  };
  return [sp ?? new URLSearchParams(), set];
}

export function Navigate({ to, replace = true }) {
  const router = useRouter();
  useEffect(() => { if (replace) router.replace(to); else router.push(to); }, [to, replace, router]);
  return null;
}
