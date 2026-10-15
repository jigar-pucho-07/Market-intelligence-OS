'use client';
// src/lib/data-context.jsx — the rows a Server Component loaded for this page, handed to the kernel. `useEntity` reads
// from here; a write dispatches `os:data-changed`, which refreshes the server tree, which updates these props — the
// same contract the kernel had with its CSV / PostgREST fetches, with the database behind the server instead.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export const DataContext = createContext({ data: {}, refresh: () => {}, loading: false, extra: {}, setExtra: () => {} });

export function DataProvider({ data, children, poll = 30000 }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [extra, setExtra] = useState({});                    // entities fetched after render (a lookup the page did not preload)
  const pending = useRef(0);
  const refresh = () => { pending.current += 1; setLoading(true); router.refresh(); };
  useEffect(() => { if (pending.current) { pending.current = 0; setLoading(false); } }, [data]);
  useEffect(() => {
    const on = () => refresh(); window.addEventListener('os:data-changed', on);
    const t = poll ? setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, poll) : null;
    return () => { window.removeEventListener('os:data-changed', on); if (t) clearInterval(t); };
  }, [poll]); // eslint-disable-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ data, refresh, loading, extra, setExtra }), [data, loading, extra]); // eslint-disable-line react-hooks/exhaustive-deps
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
export const useData = () => useContext(DataContext);
