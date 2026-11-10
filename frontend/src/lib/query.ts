import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, buildUrl, request } from './api';

type Query = Record<string, string | number | boolean | null | undefined>;
interface Entry { data: unknown; at: number; promise?: Promise<unknown> }
const cache = new Map<string, Entry>();
const STALE_MS = 60_000;

export function invalidate(prefix = '') {
  for (const k of [...cache.keys()]) if (k.includes(prefix)) cache.delete(k);
}

declare global { interface Window { __SS_PREFETCH?: Record<string, Promise<unknown>>; __SS_DATA?: Record<string, unknown> } }

/** data already fetched by the inline script → available synchronously on first render */
function seeded(key: string): unknown {
  const d = typeof window !== 'undefined' ? window.__SS_DATA?.[key] : undefined;
  if (d !== undefined && !cache.has(key)) { cache.set(key, { data: d, at: Date.now() }); delete window.__SS_PREFETCH?.[key]; }
  return cache.get(key)?.data;
}

function load<T>(key: string): Promise<T> {
  const hit = cache.get(key);
  if (hit?.promise) return hit.promise as Promise<T>;
  // reuse a request started by the inline script in index.html (hero data)
  const early = window.__SS_PREFETCH?.[key];
  if (early) delete window.__SS_PREFETCH![key];
  const p = (early ? (early as Promise<T>).catch(() => request<T>(key)) : request<T>(key)).then(
    (data) => { cache.set(key, { data, at: Date.now() }); return data; },
    (err) => { cache.delete(key); throw err; },
  );
  cache.set(key, { data: hit?.data, at: hit?.at ?? 0, promise: p });
  return p;
}

/** Prefetch into the cache (used on hover / route intent). */
export function prefetch(path: string, query?: Query) {
  const key = buildUrl(path, query);
  const hit = cache.get(key);
  if (hit && (hit.promise || Date.now() - hit.at < STALE_MS)) return;
  load(key).catch(() => undefined);
}

export interface QueryState<T> { data: T | undefined; error: ApiError | null; loading: boolean; reload: () => void }

/**
 * Tiny stale-while-revalidate fetch hook.
 * `path === null` skips the request.
 */
export function useQuery<T>(path: string | null, query?: Query, opts: { keepPrevious?: boolean } = {}): QueryState<T> {
  const key = path === null ? null : buildUrl(path, query);
  const cached = key ? (seeded(key) as T | undefined) : undefined;
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: ApiError | null; loading: boolean }>({
    key, data: cached, error: null, loading: key !== null && cached === undefined,
  });
  const [nonce, setNonce] = useState(0);
  const prevData = useRef<T | undefined>(cached);
  const lastNonce = useRef(0);

  if (state.key !== key) {
    // key changed during render: reset synchronously (avoids flashing old data unless keepPrevious)
    const next = key ? (cache.get(key)?.data as T | undefined) : undefined;
    setState({ key, data: next ?? (opts.keepPrevious ? prevData.current : undefined), error: null, loading: key !== null && next === undefined });
  }

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const forced = nonce !== lastNonce.current;
    lastNonce.current = nonce;
    const hit = cache.get(key);
    const fresh = hit && !hit.promise && Date.now() - hit.at < STALE_MS && !forced;
    if (fresh) return;
    if (forced) cache.delete(key);
    load<T>(key).then(
      (data) => { if (alive) { prevData.current = data; setState({ key, data, error: null, loading: false }); } },
      (err: unknown) => {
        if (!alive) return;
        const e = err instanceof ApiError ? err : new ApiError(0, 'NETWORK_ERROR', String(err));
        setState((s) => ({ ...s, key, error: e, loading: false }));
      },
    );
    return () => { alive = false; };
  }, [key, nonce]);

  if (state.data !== undefined) prevData.current = state.data;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data: state.data, error: state.error, loading: state.loading, reload };
}
