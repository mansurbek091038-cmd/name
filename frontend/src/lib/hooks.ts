import { useEffect, useRef, useState, type RefObject } from 'react';

export function useInView<T extends Element>(opts: { rootMargin?: string; once?: boolean; threshold?: number } = {}): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const { rootMargin = '0px', once = false, threshold = 0 } = opts;
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting);
      if (e.isIntersecting && once) io.disconnect();
    }, { rootMargin, threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin, once, threshold]);
  return [ref, inView];
}

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/* ---------- theme ---------- */
export type Theme = 'light' | 'dark';
export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, set] = useState<Theme>(getTheme);
  const apply = (t: Theme) => {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem('ss_theme', t); } catch { /* ignore */ }
    set(t);
  };
  return [theme, apply];
}

/* ---------- UTM capture (kept for the session, sent with the admission) ---------- */
const UTM_KEY = 'ss_utm';
export function captureUtm() {
  try {
    const sp = new URLSearchParams(location.search);
    const src = sp.get('utm_source');
    const camp = sp.get('utm_campaign');
    if (src || camp) sessionStorage.setItem(UTM_KEY, JSON.stringify({ utm_source: src ?? undefined, utm_campaign: camp ?? undefined }));
  } catch { /* ignore */ }
}
export function getUtm(): { utm_source?: string; utm_campaign?: string } {
  const sp = new URLSearchParams(location.search);
  const now = { utm_source: sp.get('utm_source') ?? undefined, utm_campaign: sp.get('utm_campaign') ?? undefined };
  if (now.utm_source || now.utm_campaign) return now;
  try {
    const s = sessionStorage.getItem(UTM_KEY);
    if (s) return JSON.parse(s);
  } catch { /* ignore */ }
  return {};
}

export function useLockBody(lock: boolean) {
  useEffect(() => {
    if (!lock) return;
    const prev = document.body.style.overflow;
    const sw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (sw) document.body.style.paddingRight = sw + 'px';
    return () => { document.body.style.overflow = prev; document.body.style.paddingRight = ''; };
  }, [lock]);
}

/** Close on Escape + simple focus trap for dialogs. */
export function useDialog(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current;
      const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('button, a[href], input, select, textarea');
      first?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); };
  }, [open, ref]);
}
