import type { ReactNode } from 'react';
import { BadgeCheck, EyeOff, Lock, Star } from 'lucide-react';
import { img } from '@/lib/format';
import { fmtDateTime } from '@/lib/format';
import { RedactEditor } from './RedactEditor';
import { AlbumMedia } from './AlbumMedia';
import type { AdminMedia } from './MediaField';

type Item = Record<string, unknown> & { id?: number };
export interface FieldDef {
  key: string; label: string;
  type: 'text' | 'textarea' | 'html' | 'number' | 'bool' | 'select' | 'date' | 'time' | 'datetime' | 'media' | 'url' | 'custom';
  i18n?: boolean; required?: boolean; help?: string; placeholder?: string; span?: 1 | 2; rows?: number; step?: string;
  options?: { value: string; label: string }[];
  mediaKeys?: string[]; private?: boolean; accept?: string; readOnly?: boolean;
  render?: (form: Item, set: (k: string, v: unknown) => void, errs: Record<string, string>) => ReactNode;
}
export interface ResourceDef {
  path: string; title: ReactNode; singular: string; sub?: string; addLabel?: string; wide?: boolean;
  columns: { label: string; render: (it: Item) => ReactNode }[];
  fields: FieldDef[];
  defaults: Item;
  titleOf: (it: Item) => string;
  ordered?: boolean;
  filters?: { key: string; label: string; options: { value: string; label: string }[] }[];
  extra?: (it: Item, reload: () => void) => ReactNode;
  prepare?: (form: Item) => Item;
}

const Thumb = ({ m, round }: { m: unknown; round?: boolean }) => {
  const src = img(m as AdminMedia, 'thumb');
  return src ? <img className={`a-thumb${round ? ' a-thumb--round' : ''}`} src={src} alt="" loading="lazy" /> : <span className={`a-thumb a-thumb--ph${round ? ' a-thumb--round' : ''}`} />;
};
const Vis = ({ v }: { v: unknown }) => (v === false ? <span className="tag tag--outline"><EyeOff />Yashirin</span> : <span className="tag tag--green">Ko‘rinadi</span>);
const s = (v: unknown) => String(v ?? '');
const money = (v: unknown) => (v ? Number(v).toLocaleString('ru-RU').replace(/,/g, ' ') : '—');
const ORDER: FieldDef = { key: 'order', label: 'Tartib raqami', type: 'number', span: 1, help: 'Kichik raqam — birinchi' };
const VISIBLE: FieldDef = { key: 'is_visible', label: 'Saytda ko‘rsatish', type: 'bool', span: 1 };

export const RESOURCES: Record<string, ResourceDef> = {
  posts: {
    path: '/admin/posts', title: <>Yangiliklar va <em>tadbirlar</em></>, singular: 'Yangilik', addLabel: 'Yangilik qo‘shish', wide: true,
    defaults: { type: 'news', published_at: '' },
    titleOf: (it) => s(it.title_uz) || 'Yangilik',
    filters: [{ key: 'type', label: 'Turi', options: [{ value: 'news', label: 'Yangilik' }, { value: 'event', label: 'Tadbir' }] }],
    columns: [
      { label: '', render: (it) => <Thumb m={it.cover} /> },
      { label: 'Sarlavha', render: (it) => <><b>{s(it.title_uz)}</b><small>/{s(it.slug)}</small></> },
      { label: 'Turi', render: (it) => <span className={`tag ${it.type === 'event' ? 'tag--gold' : 'tag--soft'}`}>{it.type === 'event' ? 'Tadbir' : 'Yangilik'}</span> },
      { label: 'Holat', render: (it) => <span className={`tag ${it.status === 'published' ? 'tag--green' : 'tag--outline'}`}>{it.status === 'published' ? 'E’lon qilingan' : it.status === 'scheduled' ? 'Rejalashtirilgan' : 'Qoralama'}</span> },
      { label: 'Sana', render: (it) => <span className="a-nowrap">{it.published_at ? fmtDateTime(s(it.published_at)) : '—'}</span> },
    ],
    fields: [
      { key: 'type', label: 'Turi', type: 'select', span: 1, options: [{ value: 'news', label: 'Yangilik' }, { value: 'event', label: 'Tadbir' }] },
      { key: 'slug', label: 'Slug (URL)', type: 'text', span: 1, help: 'Bo‘sh qoldirilsa sarlavhadan yaratiladi' },
      { key: 'title', label: 'Sarlavha', type: 'text', i18n: true, required: true },
      { key: 'excerpt', label: 'Qisqa tavsif', type: 'textarea', i18n: true, rows: 2 },
      { key: 'body', label: 'Matn', type: 'html', i18n: true },
      { key: 'cover_id', label: 'Muqova rasmi', type: 'media', mediaKeys: ['cover'] },
      { key: 'published_at', label: 'E’lon qilish vaqti', type: 'datetime', span: 1, help: 'Bo‘sh = qoralama; kelajak sana = rejalashtirilgan' },
      { key: 'event_date', label: 'Tadbir sanasi', type: 'datetime', span: 1 },
      { key: 'event_location', label: 'Tadbir joyi', type: 'text' },
    ],
  },
  teachers: {
    path: '/admin/teachers', title: <>O‘qituvchilar</>, singular: 'O‘qituvchi', ordered: true,
    defaults: { is_visible: true, experience_years: 0, order: 0 },
    titleOf: (it) => s(it.full_name) || 'O‘qituvchi',
    columns: [
      { label: '', render: (it) => <Thumb m={it.photo} round /> },
      { label: 'F.I.Sh.', render: (it) => <><b>{s(it.full_name)}</b><small>{s(it.subject_uz)}</small></> },
      { label: 'Nishon', render: (it) => (it.badge_uz ? <span className="tag tag--gold">{s(it.badge_uz)}</span> : '—') },
      { label: 'Tajriba', render: (it) => `${s(it.experience_years)} yil` },
      { label: 'Holat', render: (it) => <Vis v={it.is_visible} /> },
    ],
    fields: [
      { key: 'full_name', label: 'F.I.Sh.', type: 'text', required: true },
      { key: 'subject', label: 'Fan / lavozim', type: 'text', i18n: true },
      { key: 'badge', label: 'Nishon (masalan, IELTS 8.5)', type: 'text', i18n: true, span: 1 },
      { key: 'experience_years', label: 'Tajriba (yil)', type: 'number', span: 1, step: '1' },
      { key: 'bio', label: 'Qisqacha bio', type: 'textarea', i18n: true },
      { key: 'photo_id', label: 'Surat', type: 'media', mediaKeys: ['photo'] },
      VISIBLE, ORDER,
    ],
  },
  certificates: {
    path: '/admin/certificates', title: <>Sertifikatlar</>, singular: 'Sertifikat', addLabel: 'Sertifikat qo‘shish', wide: true,
    sub: 'Asl rasm yopiq saqlanadi; saytga siqilgan va raqami yashirilgan nusxa chiqadi. Saytda faqat ota-ona roziligi bor sertifikatlar ko‘rinadi.',
    defaults: { type: 'IELTS', sub_scores: {}, parent_consent: false, is_featured: false, is_new: false, order: 0, redact_regions: [], level: '' },
    titleOf: (it) => `${s(it.student_name) || 'Sertifikat'} — ${s(it.type)} ${s(it.score)}`,
    filters: [
      { key: 'type', label: 'Turi', options: ['IELTS', 'CEFR', 'SAT', 'olimpiada', 'boshqa'].map((v) => ({ value: v, label: v })) },
      { key: 'parent_consent', label: 'Rozilik', options: [{ value: 'true', label: 'Bor' }, { value: 'false', label: 'Yo‘q' }] },
      { key: 'is_featured', label: 'Sara', options: [{ value: 'true', label: 'Ha' }, { value: 'false', label: 'Yo‘q' }] },
    ],
    columns: [
      { label: '', render: (it) => <Thumb m={it.image ?? it.original_image} /> },
      { label: 'O‘quvchi', render: (it) => <><b>{s(it.student_name)}</b><small>{it.grade ? `${s(it.grade)}-sinf` : ''}{it.year ? ` · ${s(it.year)}` : ''}</small></> },
      { label: 'Natija', render: (it) => <><span className="tag">{s(it.type)}</span> <b className="serif" style={{ fontSize: 18 }}>{s(it.score)}</b></> },
      { label: 'Rozilik', render: (it) => (it.parent_consent ? <span className="tag tag--green"><BadgeCheck />Bor</span> : <span className="tag tag--outline"><Lock />Yo‘q</span>) },
      { label: 'Sara', render: (it) => (it.is_featured ? <Star className="a-star" aria-label="Sara" /> : '') },
    ],
    fields: [
      { key: 'type', label: 'Turi', type: 'select', span: 1, options: [{ value: 'IELTS', label: 'IELTS' }, { value: 'CEFR', label: 'CEFR' }, { value: 'SAT', label: 'SAT' }, { value: 'olimpiada', label: 'Olimpiada' }, { value: 'boshqa', label: 'Boshqa' }] },
      { key: 'score', label: 'Natija (8.0, B2, 1450, 1)', type: 'text', span: 1, required: true },
      { key: 'student_name', label: 'O‘quvchi F.I.Sh.', type: 'text', required: true },
      { key: 'grade', label: 'Sinf', type: 'number', span: 1, step: '1' },
      { key: 'year', label: 'Yil', type: 'number', span: 1, step: '1' },
      { key: 'date', label: 'Topshirilgan sana', type: 'date', span: 1 },
      { key: 'teacher', label: 'Mas’ul ustoz', type: 'text', span: 1 },
      { key: 'subject', label: 'Fan (olimpiada uchun)', type: 'text', span: 1 },
      { key: 'level', label: 'Bosqich (olimpiada)', type: 'select', span: 1, options: [{ value: '', label: '—' }, ...['tuman', 'shahar', 'viloyat', 'respublika', 'xalqaro'].map((v) => ({ value: v, label: v }))] },
      { key: 'sub_scores', label: 'Ballar', type: 'custom', render: (form, set) => <SubScoresInput form={form} set={set} /> },
      { key: 'cert_number', label: 'Sertifikat raqami (saytda yashiriladi)', type: 'text', span: 1 },
      { key: 'verify_url', label: 'Tekshirish havolasi', type: 'url', span: 1, placeholder: 'https://…' },
      { key: 'image_id', label: 'Sertifikat rasmi (asl nusxa)', type: 'media', private: true, mediaKeys: ['original_image', 'image'], help: 'Asl nusxa yopiq saqlanadi, saytga siqilgan nusxa chiqadi' },
      { key: 'redact_regions', label: 'Yashiriladigan joylar', type: 'custom', render: (form, set) => <RedactEditor form={form} set={set} /> },
      { key: 'parent_consent', label: 'Ota-ona roziligi bor (saytda ko‘rsatish)', type: 'bool' },
      { key: 'consent_file_id', label: 'Rozilik hujjati (PDF/rasm)', type: 'media', private: true, accept: 'image/*,application/pdf', mediaKeys: ['consent_file'] },
      { key: 'is_featured', label: 'Sara (bosh sahifa)', type: 'bool', span: 1 },
      { key: 'is_new', label: '«Yangi» belgisi', type: 'bool', span: 1 },
      ORDER,
    ],
  },
  partners: {
    path: '/admin/partners', title: <>Hamkor <em>universitetlar</em></>, singular: 'Hamkor', ordered: true,
    sub: 'Kenglik/uzunlik globusdagi oltin yoylar uchun ishlatiladi.',
    defaults: { is_visible: true, order: 0 },
    titleOf: (it) => s(it.name) || 'Hamkor',
    columns: [
      { label: '', render: (it) => <Thumb m={it.logo} /> },
      { label: 'Nomi', render: (it) => <><b>{s(it.name)}</b><small>{s(it.country_uz)} {it.country_code ? `(${s(it.country_code)})` : ''}</small></> },
      { label: 'QS', render: (it) => (it.qs_rank ? `#${s(it.qs_rank)}${it.qs_year ? ` · ${s(it.qs_year)}` : ''}` : '—') },
      { label: 'Koordinata', render: (it) => (it.lat !== null && it.lat !== undefined ? <span className="a-mono">{Number(it.lat).toFixed(2)}, {Number(it.lng).toFixed(2)}</span> : <span className="a-muted">—</span>) },
      { label: 'Holat', render: (it) => <Vis v={it.is_visible} /> },
    ],
    fields: [
      { key: 'name', label: 'Nomi', type: 'text', required: true },
      { key: 'country', label: 'Davlat', type: 'text', i18n: true, span: 1 },
      { key: 'country_code', label: 'Davlat kodi (DE, KR…)', type: 'text', span: 1 },
      { key: 'qs_rank', label: 'QS reyting', type: 'number', span: 1, step: '1' },
      { key: 'qs_year', label: 'QS yili', type: 'number', span: 1, step: '1' },
      { key: 'lat', label: 'Kenglik (lat)', type: 'number', span: 1 },
      { key: 'lng', label: 'Uzunlik (lng)', type: 'number', span: 1 },
      { key: 'website_url', label: 'Sayt', type: 'url', placeholder: 'https://…' },
      { key: 'description', label: 'Tavsif', type: 'textarea', i18n: true },
      { key: 'logo_id', label: 'Logotip', type: 'media', mediaKeys: ['logo'] },
      VISIBLE, ORDER,
    ],
  },
  albums: {
    path: '/admin/albums', title: <>Galereya <em>albomlari</em></>, singular: 'Albom', ordered: true, wide: true,
    defaults: { is_visible: true, order: 0 },
    titleOf: (it) => s(it.title_uz) || 'Albom',
    columns: [
      { label: '', render: (it) => <Thumb m={it.cover} /> },
      { label: 'Nomi', render: (it) => <b>{s(it.title_uz)}</b> },
      { label: 'Rasmlar', render: (it) => `${s(it.count ?? 0)} ta` },
      { label: 'Holat', render: (it) => <Vis v={it.is_visible} /> },
    ],
    fields: [
      { key: 'title', label: 'Albom nomi', type: 'text', i18n: true, required: true },
      { key: 'cover_id', label: 'Muqova (bo‘sh bo‘lsa birinchi rasm)', type: 'media', mediaKeys: ['cover'] },
      VISIBLE, ORDER,
    ],
    extra: (it) => <AlbumMedia albumId={it.id as number} />,
  },
  prices: {
    path: '/admin/prices', title: <>Narxlar</>, singular: 'Narx', ordered: true,
    defaults: { monthly_fee: 0, meals_fee: 0, transport_fee: 0, order: 0 },
    titleOf: (it) => s(it.grade_range) || 'Narx',
    columns: [
      { label: 'Sinflar', render: (it) => <b>{s(it.grade_range)}</b> },
      { label: 'Oylik', render: (it) => <span className="a-nowrap">{money(it.monthly_fee)}</span> },
      { label: 'Ovqat', render: (it) => <span className="a-nowrap">{money(it.meals_fee)}</span> },
      { label: 'Transport', render: (it) => <span className="a-nowrap">{money(it.transport_fee)}</span> },
    ],
    fields: [
      { key: 'grade_range', label: 'Sinflar (masalan, 1–4)', type: 'text', required: true },
      { key: 'monthly_fee', label: 'Oylik to‘lov (so‘m)', type: 'number', span: 1, step: '1' },
      { key: 'meals_fee', label: 'Ovqatlanish (so‘m)', type: 'number', span: 1, step: '1' },
      { key: 'transport_fee', label: 'Transport (so‘m)', type: 'number', span: 1, step: '1' },
      ORDER,
      { key: 'note', label: 'Izoh', type: 'textarea', i18n: true, rows: 2 },
    ],
  },
  faqs: {
    path: '/admin/faqs', title: <>Savol-javoblar</>, singular: 'Savol', ordered: true,
    defaults: { is_visible: true, order: 0 },
    titleOf: (it) => s(it.question_uz) || 'Savol',
    columns: [
      { label: 'Savol', render: (it) => <><b>{s(it.question_uz)}</b><small className="a-clamp">{s(it.answer_uz)}</small></> },
      { label: 'Holat', render: (it) => <Vis v={it.is_visible} /> },
    ],
    fields: [
      { key: 'question', label: 'Savol', type: 'text', i18n: true, required: true },
      { key: 'answer', label: 'Javob', type: 'textarea', i18n: true, rows: 5 },
      VISIBLE, ORDER,
    ],
  },
  testimonials: {
    path: '/admin/testimonials', title: <>Ota-onalar <em>fikrlari</em></>, singular: 'Fikr', addLabel: 'Yangi fikr qo‘shish', ordered: true,
    defaults: { is_visible: true, order: 0, date: '' },
    titleOf: (it) => s(it.author) || 'Fikr',
    columns: [
      { label: '', render: (it) => <Thumb m={it.photo} round /> },
      { label: 'Muallif', render: (it) => <><b>{s(it.author)}</b>{it.child_name ? <small>Farzandi: {s(it.child_name)}</small> : it.child_grade ? <small>{s(it.child_grade)}</small> : null}</> },
      { label: 'Sana', render: (it) => <span className="a-nowrap">{it.date ? s(it.date).slice(0, 10) : '—'}</span> },
      { label: 'Matn', render: (it) => <small className="a-clamp">{s(it.text_uz)}</small> },
      { label: 'Holat', render: (it) => <Vis v={it.is_visible} /> },
    ],
    fields: [
      { key: 'author', label: 'Ota-onaning ismi', type: 'text', required: true, span: 1 },
      { key: 'child_name', label: 'Farzandining ismi (ixtiyoriy)', type: 'text', span: 1 },
      { key: 'date', label: 'Sana', type: 'date', span: 1, help: 'Masalan, 2026-09-01' },
      { key: 'photo_id', label: 'Rasm (ixtiyoriy)', type: 'media', mediaKeys: ['photo'], span: 1 },
      { key: 'child_grade', label: 'Sinfi / maqomi (ixtiyoriy)', type: 'text', span: 2 },
      { key: 'text', label: 'Fikr matni', type: 'textarea', i18n: true, required: true, rows: 4 },
      VISIBLE, ORDER,
    ],
  },
  courses: {
    path: '/admin/courses', title: <>Kurslar</>, singular: 'Kurs', addLabel: 'Yangi kurs qo‘shish', ordered: true,
    defaults: { is_active: true, order: 0, price: 0 },
    titleOf: (it) => s(it.title_uz) || 'Kurs',
    columns: [
      { label: '', render: (it) => <Thumb m={it.image} /> },
      { label: 'Kurs nomi', render: (it) => <><b>{s(it.title_uz)}</b><small className="a-clamp">{s(it.description_uz)}</small></> },
      { label: 'Davomiyligi', render: (it) => <span>{s(it.duration)}</span> },
      { label: 'Narxi', render: (it) => <span className="a-nowrap">{it.price ? `${money(it.price)} so‘m` : s(it.price_text) || '—'}</span> },
      { label: 'Holat', render: (it) => (it.is_active === false ? <span className="tag tag--outline"><EyeOff />Nofaol</span> : <span className="tag tag--green">Faol</span>) },
    ],
    fields: [
      { key: 'title', label: 'Kurs nomi', type: 'text', i18n: true, required: true },
      { key: 'duration', label: 'Kurs davomiyligi (masalan, 3 oy)', type: 'text', span: 1, required: true },
      { key: 'price', label: 'Kurs narxi (so‘m, ixtiyoriy)', type: 'number', span: 1, step: '1000' },
      { key: 'price_text', label: 'Narx matni (masalan, Oyiga 650 000 so‘m)', type: 'text', span: 2 },
      { key: 'description', label: 'Kurs haqida qisqacha ma’lumot', type: 'textarea', i18n: true, rows: 4 },
      { key: 'image_id', label: 'Kurs uchun rasm', type: 'media', mediaKeys: ['image'] },
      { key: 'is_active', label: 'Kurs holati (faol / nofaol)', type: 'bool', span: 1 },
      ORDER,
    ],
  },
};

function SubScoresInput({ form, set }: { form: Item; set: (k: string, v: unknown) => void }) {
  const subs = (form.sub_scores ?? {}) as Record<string, string>;
  const type = String(form.type ?? '');
  const keys = type === 'SAT' ? ['math', 'ebrw'] : type === 'olimpiada' ? [] : ['listening', 'reading', 'writing', 'speaking'];
  if (!keys.length) return null;
  const labels: Record<string, string> = { listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking', math: 'Math', ebrw: 'Reading & Writing' };
  return (
    <div className="field">
      <span className="field__label">Bo‘limlar bo‘yicha ballar</span>
      <div className="a-subs">
        {keys.map((k) => (
          <label key={k}><span>{labels[k]}</span>
            <input className="input input--sm" value={subs[k] ?? ''} onChange={(e) => set('sub_scores', { ...subs, [k]: e.target.value })} />
          </label>
        ))}
      </div>
    </div>
  );
}
