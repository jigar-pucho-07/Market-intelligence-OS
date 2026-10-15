'use client';
// src/hooks/useEntity.js — rows for one entity, as the page's Server Component loaded them (data-context). Reload and
// the 30 s poll refresh the server tree; an entity the page did not preload is fetched once through readEntity.
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../lib/data-context';
import { fetchRows } from '../utils/api';

export function useEntity(entity) {
  const { data, refresh, loading, extra, setExtra } = useData();
  const preloaded = entity ? data?.[entity] : undefined;
  const [error, setError] = useState(null);
  const missing = !!entity && preloaded === undefined && extra[entity] === undefined;
  useEffect(() => {
    if (!missing) return;
    let on = true;
    fetchRows(entity).then((rows) => { if (on) setExtra((x) => ({ ...x, [entity]: rows })); }).catch((e) => { if (on) setError(e); });
    return () => { on = false; };
  }, [entity, missing, setExtra]);
  const rows = preloaded ?? extra[entity] ?? [];
  return { rows, loading: missing || loading, error, reload: refresh, setRows: () => {} };
}

export function useEntities(names) {
  const { data, refresh, loading } = useData();
  const key = names.join('|');
  const out = useMemo(() => Object.fromEntries(names.map((n) => [n, data?.[n] ?? []])), [key, data]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data: out, loading, reload: refresh };
}

export function useSearch(rows, keys, filters = {}) {   // eslint-disable-line no-unused-vars
  const [q, setQ] = useState('');
  const [active, setActive] = useState({});
  const filtered = useMemo(() => rows.filter((r) => {
    if (q) { const s = q.toLowerCase(); if (!keys.some((k) => String(r[k] ?? '').toLowerCase().includes(s))) return false; }
    for (const [k, v] of Object.entries(active)) if (v && r[k] !== v) return false;
    return true;
  }), [rows, q, keys, active]);
  return { q, setQ, active, setActive, filtered };
}
