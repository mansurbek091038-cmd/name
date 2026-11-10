import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { DICTS, type Dict } from '@/i18n/dict';
import { LANGS, type Lang } from './types';

const STORE_KEY = 'ss_lang';

/**
 * Language lives in the `?lang=` query param (uz = no param), matching the backend's
 * canonical/hreflang/sitemap URLs and its server-side meta injection.
 */
export function langFromSearch(search: string): Lang {
  const v = new URLSearchParams(search).get('lang');
  return v && (LANGS as string[]).includes(v) ? (v as Lang) : 'uz';
}
/** Build an internal href for `path` (may include ?query and #hash) in `lang`. */
export function localePath(lang: Lang, path: string): string {
  const p = path.startsWith('/') ? path : '/' + path;
  const hashAt = p.indexOf('#');
  const hash = hashAt >= 0 ? p.slice(hashAt) : '';
  const noHash = hashAt >= 0 ? p.slice(0, hashAt) : p;
  const [pathname, query = ''] = noHash.split('?');
  const sp = new URLSearchParams(query);
  if (lang === 'uz') sp.delete('lang'); else sp.set('lang', lang);
  const qs = sp.toString();
  return pathname + (qs ? '?' + qs : '') + hash;
}
export function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v && (LANGS as string[]).includes(v) ? (v as Lang) : null;
  } catch { return null; }
}

interface I18n { lang: Lang; t: Dict; to: (path: string) => string; setLang: (l: Lang) => void; rest: string }
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const nav = useNavigate();
  const lang = langFromSearch(loc.search);
  const rest = loc.pathname;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try { localStorage.setItem(STORE_KEY, l); } catch { /* private mode */ }
    nav(localePath(l, rest + loc.search) + loc.hash, { preventScrollReset: true });
  }, [nav, rest, loc.search, loc.hash]);

  const value = useMemo<I18n>(() => ({
    lang, rest, t: DICTS[lang], setLang, to: (p: string) => localePath(lang, p),
  }), [lang, rest, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

/** Render a dictionary string that may contain <em>accent</em> (trusted, our own text). */
export function Em({ text }: { text: string }) {
  const parts = text.split(/(<em>.*?<\/em>)/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = /^<em>(.*)<\/em>$/.exec(p);
        return m ? <em key={i}>{m[1]}</em> : <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Wrap an accent word inside a content title (API: title + title_accent). */
export function AccentTitle({ title: raw, accent: rawAccent, lang = 'uz' }: { title?: string; accent?: string; lang?: Lang }) {
  if (!raw) return null;
  const title = typo(raw, lang);
  const accent = rawAccent ? typo(rawAccent, lang) : rawAccent;
  if (!accent) return <>{title}</>;
  const i = title.toLowerCase().indexOf(accent.toLowerCase());
  if (i < 0) return <>{title} <em>{accent}</em></>;
  return <>{title.slice(0, i)}<em>{title.slice(i, i + accent.length)}</em>{title.slice(i + accent.length)}</>;
}

/** Uzbek typography for display: o' g' → o‘ g‘, other ' → ’ (content often uses ASCII apostrophes). */
export function typo(text: string | undefined, lang: Lang): string {
  if (!text) return '';
  if (lang !== 'uz') return text;
  return text.replace(/([oOgG])['`ʻ‘]/g, '$1\u2018').replace(/(\w)['`ʼ]/g, '$1\u2019');
}
/** Turn a CMS title into our dictionary format with the last word as the gold italic accent. */
export function accentLast(text: string | undefined, lang: Lang): string | undefined {
  if (!text) return undefined;
  const t = typo(text.trim(), lang);
  return t.replace(/(\S+?)([.!?…»"]*)$/, '<em>$1</em>$2');
}
