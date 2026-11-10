import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowDown, ArrowUp, Braces, ChevronDown, Copy, ExternalLink, FileText, Plus, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { fmtDateTime, img } from '@/lib/format';
import { LANGS, type Lang } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { MediaField, type AdminMedia } from './MediaField';
import { Empty, LangTabs, Loading, PageHead, Toggle } from './ui';

type J = unknown;
type Obj = Record<string, J>;
interface PageAdmin {
  id: number; key: string; blocks_uz: Obj; blocks_ru: Obj; blocks_en: Obj; og_image_id: number | null; og_image: AdminMedia | null;
  media: Record<string, AdminMedia>; updated_at: string; [k: string]: J;
}
const MEDIA_KEYS = new Set(['image', 'og_image', 'cover', 'photo', 'logo', 'background']);
const MEDIA_LIST_KEYS = new Set(['images', 'gallery']);
const PAGE_LABEL: Record<string, string> = { home: 'Bosh sahifa', about: 'Maktab haqida', admission: 'Qabul', contact: 'Aloqa', privacy: 'Maxfiylik', thanks: 'Rahmat sahifasi', results: 'Natijalar', partners: 'Hamkorlar' };
const PAGE_URL: Record<string, string> = { home: '/', admission: '/qabul', contact: '/aloqa', privacy: '/maxfiylik', thanks: '/rahmat', results: '/natijalar', partners: '/', about: '/' };
const LABEL: Record<string, string> = {
  hero: 'Hero — bosh ekran', stats: 'Raqamlar lentasi', why: 'Nega biz (bento)', cta: 'Qabul chaqiruvi', stages: 'Ta’lim bosqichlari', day: 'Kun tartibi', sections: 'Bo‘lim sarlavhalari',
  title: 'Sarlavha', title_accent: 'Oltin kursiv so‘z', text: 'Matn', badge: 'Nishon', motto: 'Shior', cta_primary: 'Asosiy tugma', cta_secondary: 'Ikkinchi tugma', image: 'Rasm',
  value: 'Qiymat', suffix: 'Qo‘shimcha (+, %)', label: 'Yozuv', icon: 'Ikonka (lucide nomi)', key: 'Kalit', ages: 'Yosh', grades: 'Sinflar', points: 'Punktlar', time: 'Vaqt',
  steps: 'Qadamlar', documents: 'Hujjatlar', address: 'Manzil', phones: 'Telefonlar', telegram: 'Telegram', instagram: 'Instagram', hours: 'Ish vaqti', map_embed_url: 'Xarita (embed URL)',
  lat: 'Kenglik', lng: 'Uzunlik', story: 'Tarix', mission: 'Missiya', values: 'Qadriyatlar', founded_year: 'Tashkil topgan yil', body: 'Matn (HTML)', button: 'Tugma matni', updated: 'Yangilangan sana',
  admission_open: 'Qabul nishoni (yashil)', questions: 'Savollar uchun matni', photo_caption: 'Rasm izohi (alt)', documents_title: 'Hujjatlar sarlavhasi', faq_title: 'FAQ sarlavhasi', prices_title: 'Narxlar sarlavhasi', values_title: 'Qadriyatlar sarlavhasi',
  why_title: 'Nega biz — sarlavha', why_subtitle: 'Nega biz — matn', stages_title: 'Bosqichlar — sarlavha', stages_text: 'Bosqichlar — matn', teachers_title: 'Ustozlar — sarlavha', teachers_text: 'Ustozlar — matn',
  testimonials_title: 'Fikrlar — sarlavha', testimonials_text: 'Fikrlar — matn', day_badge: 'Kun tartibi — nishon', day_title: 'Kun tartibi — sarlavha', day_text: 'Kun tartibi — matn', news_title: 'Yangiliklar — sarlavha',
  results_kicker: 'Natijalar — nishon', results_title: 'Natijalar — sarlavha', results_text: 'Natijalar — matn', photo: 'Surat', cover: 'Muqova', og_image: 'OG rasm',
  logo: 'Logotip', benefits: 'Afzalliklar', privacy_note: 'Maxfiylik izohi', stats_labels: 'Statistika yozuvlari', cta_title: 'Chaqiruv sarlavhasi', cta_button: 'Chaqiruv tugmasi',
};
const human = (k: string) => LABEL[k] ?? k.replace(/_/g, ' ');
const isObj = (v: J): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const blank = (tpl: J): J => (Array.isArray(tpl) ? [] : isObj(tpl) ? Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, MEDIA_KEYS.has(k) ? null : blank(v)])) : typeof tpl === 'number' ? 0 : typeof tpl === 'boolean' ? false : '');
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v ?? null));

export default function PagesEditor() {
  const { key } = useParams();
  const nav = useNavigate();
  const { data: pages, error } = useQuery<{ id: number; key: string; updated_at: string }[]>('/admin/pages');
  useEffect(() => { if (!key && pages?.length) nav(`/admin/sahifalar/${pages.find((p) => p.key === 'home')?.key ?? pages[0].key}`, { replace: true }); }, [key, pages, nav]);
  return (
    <>
      <PageHead eyebrow="Kontent" title={<>Sahifa <em>bloklari</em></>} sub="Sahifalardagi matnlar, rasmlar va SEO. Rus va ingliz tillarida bo‘sh qolgan joylarga o‘zbekcha matn qo‘yiladi." />
      {error ? <ErrorNotice error={error} /> : (
        <div className="a-pages">
          <nav className="a-pages__list" aria-label="Sahifalar">
            {(pages ?? []).map((p) => (
              <Link key={p.key} to={`/admin/sahifalar/${p.key}`} className={p.key === key ? 'is-on' : ''}>
                <FileText /><span><b>{PAGE_LABEL[p.key] ?? p.key}</b><small>{fmtDateTime(p.updated_at)}</small></span>
              </Link>
            ))}
          </nav>
          {key ? <PageForm key={key} pageKey={key} /> : <Loading />}
        </div>
      )}
    </>
  );
}

function PageForm({ pageKey }: { pageKey: string }) {
  const toast = useToast();
  const { data, error, reload } = useQuery<PageAdmin>(`/admin/pages/${pageKey}`);
  const [form, setForm] = useState<PageAdmin | null>(null);
  const [lang, setLang] = useState<Lang>('uz');
  const [raw, setRaw] = useState(false);
  const [rawText, setRawText] = useState('');
  const [rawErr, setRawErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<unknown>(null);
  const [media, setMedia] = useState<Record<string, AdminMedia>>({});
  useEffect(() => { if (data) { setForm(clone(data)); setMedia(data.media ?? {}); } }, [data]);
  useEffect(() => { if (form && raw) setRawText(JSON.stringify(form[`blocks_${lang}`] ?? {}, null, 2)); /* eslint-disable-next-line */ }, [raw, lang]);
  const dirty = useMemo(() => !!form && !!data && JSON.stringify(form) !== JSON.stringify(data), [form, data]);

  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (!form) return <Loading />;
  const blocksKey = `blocks_${lang}` as const;
  const uz = form.blocks_uz ?? {};
  const cur = (form[blocksKey] ?? {}) as Obj;
  const setBlocks = (b: Obj) => setForm({ ...form, [blocksKey]: b });
  const filled = Object.fromEntries(LANGS.map((l) => [l, Object.keys((form[`blocks_${l}`] as Obj) ?? {}).length > 0])) as Record<Lang, boolean>;

  const save = async () => {
    let f = form;
    if (raw) {
      try { f = { ...form, [blocksKey]: JSON.parse(rawText) }; setForm(f); } catch (e) { setRawErr((e as Error).message); return; }
    }
    setBusy(true); setSaveErr(null);
    const body: Record<string, J> = { blocks_uz: f.blocks_uz, blocks_ru: f.blocks_ru, blocks_en: f.blocks_en, og_image_id: f.og_image_id };
    for (const l of LANGS) { body[`seo_title_${l}`] = f[`seo_title_${l}`] ?? ''; body[`seo_description_${l}`] = f[`seo_description_${l}`] ?? ''; }
    try {
      await api.put(`/admin/pages/${pageKey}`, body);
      invalidate(`/admin/pages`); invalidate('/public/pages'); reload(); toast('Sahifa saqlandi');
    } catch (e) { setSaveErr(e); if (e instanceof ApiError) toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="a-pageform">
      <div className="a-pageform__bar">
        <LangTabs value={lang} onChange={setLang} filled={filled} />
        <div className="a-pageform__tools">
          <button type="button" className={`btn btn--ghost btn--xs${raw ? ' is-on' : ''}`} aria-pressed={raw} onClick={() => setRaw(!raw)}><Braces />JSON</button>
          {lang !== 'uz' && !raw && <button type="button" className="btn btn--ghost btn--xs" onClick={() => setBlocks(fillFrom(uz, cur))} title="Bo‘sh joylarni o‘zbekcha matn bilan to‘ldirish (tarjima uchun)"><Copy />UZ dan to‘ldirish</button>}
          <a className="btn btn--ghost btn--xs" href={(PAGE_URL[pageKey] ?? '/') + (lang === 'uz' ? '' : `?lang=${lang}`)} target="_blank" rel="noopener"><ExternalLink />Saytda</a>
          <button type="button" className="btn btn--ink btn--sm" onClick={save} disabled={busy || (!dirty && !raw)}>{busy && <span className="spinner" />}Saqlash</button>
        </div>
      </div>
      {saveErr != null && <ErrorNotice error={saveErr} compact />}

      <details className="a-block" open={false}>
        <summary><span>SEO va ulashish</span><ChevronDown /></summary>
        <div className="a-block__body a-form">
          <div className="field"><label className="field__label" htmlFor="seo-t">SEO sarlavha <small className="a-lang-chip">{lang.toUpperCase()}</small></label>
            <input id="seo-t" className="input input--sm" value={String(form[`seo_title_${lang}`] ?? '')} onChange={(e) => setForm({ ...form, [`seo_title_${lang}`]: e.target.value })} /></div>
          <div className="field"><label className="field__label" htmlFor="seo-d">SEO tavsif <small className="a-lang-chip">{lang.toUpperCase()}</small></label>
            <textarea id="seo-d" className="textarea" rows={2} value={String(form[`seo_description_${lang}`] ?? '')} onChange={(e) => setForm({ ...form, [`seo_description_${lang}`]: e.target.value })} />
            <span className="field__hint">{String(form[`seo_description_${lang}`] ?? '').length}/160 belgi</span></div>
          <MediaField label="Ulashish rasmi (OG)" value={form.og_image_id} media={form.og_image} onChange={(id, m) => setForm({ ...form, og_image_id: id, og_image: m })} />
        </div>
      </details>

      {raw ? (
        <div className="field">
          <textarea className="textarea a-mono a-json" rows={28} value={rawText} onChange={(e) => { setRawText(e.target.value); setRawErr(''); }} spellCheck={false} aria-label="JSON" />
          {rawErr && <span className="field__error">JSON xatosi: {rawErr}</span>}
          <span className="field__hint">Rasm maydonlari (image, cover, logo…) media ID raqamini saqlaydi.</span>
        </div>
      ) : Object.keys(uz).length === 0 && lang === 'uz' ? (
        <Empty>Bu sahifada hali bloklar yo‘q. JSON rejimida yarating.</Empty>
      ) : (
        Object.keys(lang === 'uz' ? uz : { ...uz, ...cur }).map((k) => (
          <details key={k} className="a-block" open={['hero', 'title', 'steps', 'address', 'body'].includes(k)}>
            <summary><span>{human(k)}</span><small className="a-mono">{k}</small><ChevronDown /></summary>
            <div className="a-block__body">
              <Node k={k} tpl={uz[k]} value={cur[k]} lang={lang} media={media} onMedia={(id, m) => m && setMedia((s) => ({ ...s, [String(id)]: m }))}
                onChange={(v) => setBlocks({ ...cur, [k]: v })} />
            </div>
          </details>
        ))
      )}
    </div>
  );
}

/** Fill gaps of a translation with the uz values (keeps existing translations). */
function fillFrom(uz: J, cur: J): Obj {
  const go = (b: J, o: J, key?: string): J => {
    if (key && MEDIA_KEYS.has(key)) return o ?? null;
    if (o === undefined || o === null || o === '') return clone(b);
    if (isObj(b) && isObj(o)) return Object.fromEntries(Object.keys({ ...b, ...o }).map((k) => [k, go(b[k], o[k], k)]));
    if (Array.isArray(b) && Array.isArray(o) && b.length === o.length) return b.map((x, i) => go(x, o[i], key));
    return o;
  };
  return go(uz, cur) as Obj;
}

/**
 * Recursive JSON-aware editor. `tpl` is the uz structure; `value` the current language's value.
 * On the uz tab they are the same object; on ru/en the uz value is shown as a placeholder and
 * arrays of the same length are translated item by item (backend merges by index).
 */
function Node({ k, tpl, value, lang, onChange, media, onMedia }: {
  k: string; tpl: J; value: J; lang: Lang; onChange: (v: J) => void; media: Record<string, AdminMedia>; onMedia: (id: number, m: AdminMedia | null) => void;
}): ReactNode {
  const base = lang === 'uz' ? value : tpl ?? value;
  const id = `pb-${k}-${useId().replace(/:/g, '')}`;

  if (MEDIA_KEYS.has(k)) {
    if (lang !== 'uz') return <p className="a-muted a-small">Rasm barcha tillar uchun umumiy (UZ tabida o‘zgartiriladi).</p>;
    const mid = typeof value === 'number' ? value : null;
    return <MediaField label={human(k)} value={mid} media={mid ? media[String(mid)] : null} onChange={(nid, m) => { if (nid && m) onMedia(nid, m); onChange(nid); }} />;
  }
  if (MEDIA_LIST_KEYS.has(k) && Array.isArray(base)) {
    if (lang !== 'uz') return <p className="a-muted a-small">Rasmlar barcha tillar uchun umumiy.</p>;
    const ids = (value as number[]) ?? [];
    return (
      <div className="a-media-list">
        {ids.map((mid, i) => (
          <figure key={i}>{media[String(mid)] ? <img src={img(media[String(mid)], 'thumb')} alt="" /> : <span className="a-thumb a-thumb--ph" />}
            <button type="button" className="icon-btn a-danger-text" aria-label="O‘chirish" onClick={() => onChange(ids.filter((_, j) => j !== i))}><Trash2 /></button></figure>
        ))}
        <MediaField label="Rasm qo‘shish" value={null} onChange={(nid, m) => { if (nid) { if (m) onMedia(nid, m); onChange([...ids, nid]); } }} />
      </div>
    );
  }

  if (Array.isArray(base)) {
    const arr = Array.isArray(value) ? value : [];
    const tplArr = Array.isArray(tpl) ? tpl : [];
    const structural = lang === 'uz' || (Array.isArray(value) && value.length !== tplArr.length);
    const items = structural ? arr : tplArr;
    const setAt = (i: number, v: J) => {
      const next = structural ? [...arr] : Array.from({ length: tplArr.length }, (_, j) => (Array.isArray(value) ? value[j] ?? null : null));
      next[i] = v;
      onChange(next);
    };
    const move = (i: number, d: number) => { const n = [...arr]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; onChange(n); };
    const primitive = items.every((x) => !isObj(x) && !Array.isArray(x));
    return (
      <div className={`a-arr${primitive ? ' a-arr--prim' : ''}`}>
        {items.map((it, i) => (
          <div key={i} className="a-arr__item">
            <div className="a-arr__head">
              <span className="a-arr__n">{i + 1}</span>
              {primitive ? (
                <PrimInput id={`${id}-${i}`} k={k} tpl={tplArr[i]} value={structural ? it : (Array.isArray(value) ? value[i] : undefined)} lang={lang} onChange={(v) => setAt(i, v)} />
              ) : <span className="a-arr__title">{String((isObj(it) && (it.title ?? it.label ?? it.time ?? it.key)) ?? '') || `#${i + 1}`}</span>}
              {structural && (
                <span className="a-arr__tools">
                  <button type="button" className="icon-btn" aria-label="Yuqoriga" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
                  <button type="button" className="icon-btn" aria-label="Pastga" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
                  <button type="button" className="icon-btn a-danger-text" aria-label="O‘chirish" onClick={() => onChange(arr.filter((_, j) => j !== i))}><Trash2 /></button>
                </span>
              )}
            </div>
            {!primitive && (
              <div className="a-arr__body">
                <Node k={k} tpl={tplArr[i] ?? it} value={structural ? it : (Array.isArray(value) ? value[i] : undefined)} lang={lang} media={media} onMedia={onMedia} onChange={(v) => setAt(i, v)} />
              </div>
            )}
          </div>
        ))}
        {structural && (
          <button type="button" className="btn btn--ghost btn--xs" onClick={() => onChange([...arr, blank(arr[arr.length - 1] ?? tplArr[0] ?? '')])}><Plus />Qo‘shish</button>
        )}
        {!structural && <p className="a-muted a-small">Elementlar soni UZ tabida boshqariladi; bu yerda faqat tarjima.</p>}
      </div>
    );
  }

  if (isObj(base)) {
    const obj = isObj(value) ? value : {};
    const keys = Object.keys(lang === 'uz' ? obj : { ...(isObj(tpl) ? tpl : {}), ...obj });
    return (
      <div className="a-obj">
        {keys.map((ck) => {
          const tv = isObj(tpl) ? tpl[ck] : undefined;
          const cv = obj[ck];
          const complex = isObj(tv ?? cv) || Array.isArray(tv ?? cv);
          return (
            <div key={ck} className={`a-obj__row${complex ? ' a-obj__row--block' : ''}`}>
              {complex ? <span className="a-obj__label">{human(ck)}</span> : null}
              <Node k={ck} tpl={tv} value={cv} lang={lang} media={media} onMedia={onMedia} onChange={(v) => onChange({ ...obj, [ck]: v })} />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}><span>{human(k)}</span><small className="a-mono">{k}</small></label>
      <PrimInput id={id} k={k} tpl={tpl} value={value} lang={lang} onChange={onChange} />
    </div>
  );
}

function PrimInput({ id, k, tpl, value, lang, onChange }: { id: string; k: string; tpl: J; value: J; lang: Lang; onChange: (v: J) => void }) {
  const sample = lang === 'uz' ? value : tpl ?? value;
  const ph = lang !== 'uz' && tpl !== undefined && tpl !== null ? String(tpl) : '';
  if (typeof sample === 'boolean') return <Toggle id={id} checked={!!(value ?? tpl)} onChange={onChange} label={human(k)} />;
  if (typeof sample === 'number' && lang === 'uz') return <input id={id} className="input input--sm" type="number" step="any" value={value === null || value === undefined ? '' : String(value)} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} />;
  const s = value === null || value === undefined ? '' : String(value);
  const long = (ph || s).length > 90 || /\n|<\w+/.test(ph || s) || k === 'body' || k === 'html';
  return long
    ? <textarea id={id} className={`textarea${k === 'body' || k === 'html' ? ' a-mono' : ''}`} rows={k === 'body' ? 10 : 3} value={s} placeholder={ph} onChange={(e) => onChange(e.target.value)} />
    : <input id={id} className="input input--sm" value={s} placeholder={ph} onChange={(e) => onChange(typeof sample === 'number' && /^\d+(\.\d+)?$/.test(e.target.value) ? Number(e.target.value) : e.target.value)} />;
}
