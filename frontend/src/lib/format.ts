import type { ImageRef, Lang, Media } from './types';
import type { Dict } from '@/i18n/dict';
import { ApiError } from './api';

/* ---------- phone: +998 XX XXX XX XX ---------- */
export function phoneDigits(v: string): string {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('998')) d = d.slice(3);
  return d.slice(0, 9);
}
export function formatPhone(v: string): string {
  const d = phoneDigits(v);
  let out = '+998';
  if (d.length) out += ' ' + d.slice(0, 2);
  if (d.length > 2) out += ' ' + d.slice(2, 5);
  if (d.length > 5) out += ' ' + d.slice(5, 7);
  if (d.length > 7) out += ' ' + d.slice(7, 9);
  return out;
}
export const isPhoneComplete = (v: string) => phoneDigits(v).length === 9;
export const normalizePhone = (v: string) => '+998' + phoneDigits(v);
export function prettyPhone(raw?: string | null): string {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) return formatPhone(d);
  return raw;
}
export const telHref = (raw: string) => 'tel:' + raw.replace(/[^\d+]/g, '');

/* ---------- money ---------- */
export function money(n: number | null | undefined, t: Dict): string {
  if (n === null || n === undefined) return '—';
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${s} ${t.sum}`;
}

/* ---------- dates ---------- */
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const UZ_DAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const LOCALE: Record<Lang, string> = { uz: 'uz-Latn-UZ', ru: 'ru-RU', en: 'en-GB' };

export function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  // dd.mm.yyyy legacy format
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s);
  return isNaN(d.getTime()) ? null : d;
}
export function fmtDate(s: string | null | undefined, lang: Lang, opts: { short?: boolean } = {}): string {
  const d = parseDate(s);
  if (!d) return s ?? '';
  if (lang === 'uz') {
    const mo = opts.short ? UZ_MONTHS_SHORT[d.getMonth()] : UZ_MONTHS[d.getMonth()];
    return `${d.getDate()}-${mo}, ${d.getFullYear()}`;
  }
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: opts.short ? 'short' : 'long', year: 'numeric' }).format(d);
}
export function dateParts(s: string, lang: Lang): { day: string; month: string; weekday: string } {
  const d = parseDate(s) ?? new Date();
  if (lang === 'uz') return { day: String(d.getDate()), month: UZ_MONTHS[d.getMonth()], weekday: UZ_DAYS[d.getDay()] };
  return {
    day: String(d.getDate()),
    month: new Intl.DateTimeFormat(LOCALE[lang], { month: 'long' }).format(d),
    weekday: new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long' }).format(d),
  };
}
export function fmtDateTime(s?: string | null): string {
  const d = parseDate(s);
  if (!d) return s ?? '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fmtDay(s?: string | null): string {
  const d = parseDate(s);
  if (!d) return s ?? '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/* ---------- media ---------- */
export function img(ref: ImageRef, size: 'thumb' | 'medium' | 'large' | 'url' = 'medium'): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === 'string') return ref;
  const m = ref as Media;
  return (size !== 'url' ? m[size] : null) || m.medium || m.large || m.url || m.thumb || undefined;
}
export function srcSet(ref: ImageRef): string | undefined {
  if (!ref || typeof ref === 'string') return undefined;
  const parts: string[] = [];
  if (ref.thumb) parts.push(`${ref.thumb} 400w`);
  if (ref.medium) parts.push(`${ref.medium} 960w`);
  if (ref.large) parts.push(`${ref.large} 1920w`);
  return parts.length > 1 ? parts.join(', ') : undefined;
}
export function alt(ref: ImageRef, fallback = ''): string {
  if (ref && typeof ref === 'object' && ref.alt) return ref.alt;
  return fallback;
}

/* ---------- errors ---------- */
export function errorText(e: unknown, t: Dict): { title: string; text: string; code: string } {
  if (e instanceof ApiError) {
    const map: Record<string, string> = {
      NETWORK_ERROR: t.errNetwork,
      RATE_LIMITED: t.errRate,
      TOUR_FULL: t.errTourFull,
      NOT_FOUND: t.errNotFound,
      ALREADY_BOOKED: t.errAlreadyBooked,
      TOUR_CLOSED: t.errTourClosed,
      CAPTCHA_REQUIRED: t.errCaptcha,
      CAPTCHA_FAILED: t.errCaptcha,
      CSRF_FAILED: t.errCsrf,
    };
    let text = map[e.code];
    if (!text && e.code === 'VALIDATION_ERROR') text = e.fields ? Object.values(e.fields).join(' · ') || t.errValidation : (e.message || t.errValidation);
    if (!text && e.status >= 500) text = t.errServer;
    return { title: t.errTitle, text: text || e.message || t.errServer, code: e.code };
  }
  return { title: t.errTitle, text: String((e as Error)?.message ?? e), code: 'UNKNOWN' };
}

export function readingTime(html?: string): number {
  if (!html) return 1;
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function gradeLabel(g: string | number | null | undefined, t: Dict, lang: Lang): string {
  if (g === null || g === undefined || g === '') return '';
  if (String(g) === '0') return t.gradePrep;
  if (lang === 'en') {
    const n = Number(g);
    const suf = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
    return isNaN(n) ? `${g} grade` : `${n}${suf} grade`;
  }
  return `${g}${t.gradeShort}`;
}
