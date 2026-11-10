import type { SiteSettings } from './types';

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; ym?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; callMethod?: unknown } }
}

let done = false;
let ga = '';
let ym = 0;

const idle = (fn: () => void) => ('requestIdleCallback' in window ? (window as Window & { requestIdleCallback: (f: () => void) => void }).requestIdleCallback(fn) : setTimeout(fn, 1500));
const add = (src: string) => { const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); };

/** Analytics are injected only when their IDs are configured in the admin settings. */
export function injectAnalytics(s: SiteSettings) {
  if (done) return;
  done = true;
  idle(() => {
    if (s.ga4_id && /^G-[A-Z0-9]+$/i.test(s.ga4_id)) {
      ga = s.ga4_id;
      add(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() { window.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
      window.gtag('js', new Date());
      window.gtag('config', ga);
    }
    if (s.ym_id && /^\d+$/.test(s.ym_id)) {
      ym = Number(s.ym_id);
      const w = window as unknown as { ym: { a?: unknown[]; l?: number } & ((...a: unknown[]) => void) };
      w.ym = Object.assign(function (...a: unknown[]) { (w.ym.a = w.ym.a || []).push(a); }, { l: Date.now() });
      add('https://mc.yandex.ru/metrika/tag.js');
      window.ym!(ym, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
    }
    if (s.meta_pixel_id && /^\d+$/.test(s.meta_pixel_id)) {
      const f = function (...a: unknown[]) { (f.queue = f.queue || []).push(a); } as NonNullable<Window['fbq']>;
      f.queue = []; f.loaded = true; f.version = '2.0';
      window.fbq = f;
      add('https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', s.meta_pixel_id);
      window.fbq('track', 'PageView');
    }
  });
}

let first = true;
export function trackPage(path: string) {
  if (first) { first = false; return; }
  if (ga && window.gtag) window.gtag('event', 'page_view', { page_path: path });
  if (ym && window.ym) window.ym(ym, 'hit', path);
  if (window.fbq) window.fbq('track', 'PageView');
}
