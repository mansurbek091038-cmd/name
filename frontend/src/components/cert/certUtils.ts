import type { Dict } from '@/i18n/dict';
import type { Certificate, Lang, SubScores } from '@/lib/types';
import { gradeLabel } from '@/lib/format';

export const CERT_TYPES = ['IELTS', 'CEFR', 'SAT', 'olimpiada', 'boshqa'] as const;

export function typeLabel(type: string, t: Dict): string {
  const k = type.toLowerCase();
  if (k === 'olimpiada' || k === 'olympiad') return t.typeOlympiad;
  if (k === 'boshqa' || k === 'other') return t.typeOther;
  return type.toUpperCase();
}
export const isOlymp = (type: string) => ['olimpiada', 'olympiad'].includes(type.toLowerCase());

export function scoreText(c: Pick<Certificate, 'type' | 'score'>, t: Dict): string {
  const s = String(c.score ?? '').trim();
  if (!s) return '—';
  if (isOlymp(c.type) && /^\d+$/.test(s)) return `${s}${t.place}`;
  return s;
}

/** Short label for the tag on a card: "IELTS 8.0", "CEFR B2", "SAT 1450", "Olimpiada · 1-o‘rin". */
export function tagText(c: Certificate, t: Dict): string {
  if (isOlymp(c.type)) return `${t.typeOlympiad} · ${scoreText(c, t)}`;
  return `${typeLabel(c.type, t)} ${scoreText(c, t)}`;
}

export interface SubRow { key: keyof SubScores; label: string; short: string; value: string; pct: number }
export function subRows(c: Certificate, t: Dict): SubRow[] {
  const s = c.sub_scores ?? {};
  const type = c.type.toUpperCase();
  const max = type === 'IELTS' ? 9 : type === 'SAT' ? 800 : type === 'CEFR' ? 75 : 100;
  const min = type === 'SAT' ? 200 : 0;
  const keys: (keyof SubScores)[] = type === 'SAT' ? ['math', 'ebrw'] : ['listening', 'reading', 'writing', 'speaking', 'math', 'ebrw'];
  const out: SubRow[] = [];
  for (const k of keys) {
    const raw = s[k];
    if (raw === null || raw === undefined || raw === '') continue;
    const n = parseFloat(String(raw));
    const pct = isNaN(n) ? 0 : Math.max(4, Math.min(100, ((n - min) / (max - min)) * 100));
    out.push({ key: k, label: t[k], short: k === 'ebrw' ? 'R&W' : k[0].toUpperCase(), value: String(raw), pct });
  }
  return out;
}

export function certMeta(c: Certificate, t: Dict, lang: Lang): string {
  return [gradeLabel(c.grade, t, lang), c.year].filter(Boolean).join(' · ');
}
