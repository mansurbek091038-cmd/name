import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { ArrowDown, ArrowUp, Bold, Eye, Heading2, Italic, Link2, List, Pencil, Plus, Quote, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { useDebounced } from '@/lib/hooks';
import { LANGS, type Lang, type Paged } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { Drawer, Empty, LangTabs, Loading, PageHead, Pagination, Toggle, useConfirm } from './ui';
import { MediaField, type AdminMedia } from './MediaField';
import { RESOURCES, type FieldDef, type ResourceDef } from './resources';

type Item = Record<string, unknown> & { id?: number };

export const toLocalInput = (iso?: unknown) => {
  if (!iso || typeof iso !== 'string') return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function ResourcePage({ resource: propRes }: { resource?: string } = {}) {
  const params = useParams();
  const resource = propRes || params.resource || '';
  const def = RESOURCES[resource];
  if (!def) return <Empty>Noma’lum bo‘lim.</Empty>;
  return <ResourceList key={resource} def={def} />;
}

function ResourceList({ def }: { def: ResourceDef }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 300);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Item | null>(null);
  const pageSize = def.ordered ? 100 : 20;
  const list = useQuery<Paged<Item>>(def.path, { search: dq, page, page_size: pageSize, ...filter }, { keepPrevious: true });
  useEffect(() => setPage(1), [dq, filter]);
  const refresh = () => { invalidate(def.path); invalidate('/public/'); list.reload(); };

  const remove = async (it: Item) => {
    if (!(await confirm(`«${def.titleOf(it)}» o‘chirilsinmi?`, { danger: true, ok: 'O‘chirish' }))) return;
    try { await api.del(`${def.path}/${it.id}`); toast('O‘chirildi'); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const move = async (idx: number, dir: -1 | 1) => {
    const items = list.data?.items ?? [];
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((x) => x.id as number);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    try { await api.post(`${def.path}/reorder`, { ids }); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <PageHead eyebrow="Kontent" title={def.title} sub={def.sub}
        actions={<button type="button" className="btn btn--gold btn--sm" onClick={() => setEditing({ ...def.defaults })}><Plus />{def.addLabel ?? 'Qo‘shish'}</button>} />
      <div className="a-filters">
        <label className="input-icon a-filters__search"><Search /><span className="sr-only">Qidirish</span>
          <input className="input input--sm" placeholder="Qidirish…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {def.filters?.map((f) => (
          <select key={f.key} className="select select--sm" aria-label={f.label} value={filter[f.key] ?? ''} onChange={(e) => setFilter({ ...filter, [f.key]: e.target.value })}>
            <option value="">{f.label}: barchasi</option>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ))}
      </div>
      {list.error ? <ErrorNotice error={list.error} onRetry={list.reload} /> : !list.data ? <Loading /> : (
        <div className="a-panel a-panel--flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr>{def.columns.map((c) => <th key={c.label}>{c.label}</th>)}<th className="a-actions-col"><span className="sr-only">Amallar</span></th></tr></thead>
              <tbody>
                {list.data.items.map((it, i) => (
                  <tr key={it.id as number} onClick={() => setEditing(it)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setEditing(it); }}>
                    {def.columns.map((c) => <td key={c.label}>{c.render(it)}</td>)}
                    <td className="a-actions-col" onClick={(e) => e.stopPropagation()}>
                      <div className="a-row-actions">
                        {def.ordered && !dq && <>
                          <button type="button" className="icon-btn" aria-label="Yuqoriga" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></button>
                          <button type="button" className="icon-btn" aria-label="Pastga" disabled={i === list.data!.items.length - 1} onClick={() => move(i, 1)}><ArrowDown /></button>
                        </>}
                        <button type="button" className="icon-btn" aria-label="Tahrirlash" onClick={() => setEditing(it)}><Pencil /></button>
                        <button type="button" className="icon-btn a-danger-text" aria-label="O‘chirish" onClick={() => remove(it)}><Trash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <Empty>Hozircha yozuvlar yo‘q.</Empty>}
          </div>
          <Pagination page={page} pages={list.data.pages} total={list.data.total} onPage={setPage} />
        </div>
      )}
      <Editor def={def} item={editing} onClose={() => setEditing(null)} onSaved={(saved) => { refresh(); setEditing(saved); }} />
    </>
  );
}

function Editor({ def, item, onClose, onSaved }: { def: ResourceDef; item: Item | null; onClose: () => void; onSaved: (i: Item) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Item>({});
  const [lang, setLang] = useState<Lang>('uz');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { if (item) { setForm({ ...def.defaults, ...item }); setErrs({}); setError(null); setLang('uz'); } }, [item, def.defaults]);
  const isNew = !item?.id;
  const set = (k: string, v: unknown) => { setForm((f) => ({ ...f, [k]: v })); setErrs((e) => ({ ...e, [k]: '' })); };

  const i18nKeys = def.fields.filter((f) => f.i18n).map((f) => f.key);
  const filled = useMemo(() => Object.fromEntries(LANGS.map((l) => [l, i18nKeys.some((k) => String(form[`${k}_${l}`] ?? '').trim())])) as Record<Lang, boolean>, [form, i18nKeys]);
  const langErr = Object.fromEntries(LANGS.map((l) => [l, i18nKeys.some((k) => errs[`${k}_${l}`])])) as Record<Lang, boolean>;

  const save = async () => {
    const body: Record<string, unknown> = {};
    for (const f of def.fields) {
      if (f.readOnly) continue;
      const keys = f.i18n ? LANGS.map((l) => `${f.key}_${l}`) : [f.key];
      for (const k of keys) {
        let v = form[k];
        if (f.type === 'number') v = v === '' || v === undefined || v === null ? null : Number(v);
        if (f.type === 'datetime') v = v ? (String(v).length === 16 ? String(v) + ':00' : toLocalInput(v) ? toLocalInput(v) + ':00' : v) : null;
        if (f.type === 'date') v = v ? String(v).slice(0, 10) : null;
        if ((f.type === 'text' || f.type === 'textarea' || f.type === 'html' || f.type === 'url') && (v === null || v === undefined)) v = '';
        if (f.type === 'media' && v === undefined) v = null;
        body[k] = v;
      }
    }
    if (def.prepare) Object.assign(body, def.prepare(form));
    setBusy(true); setError(null);
    try {
      const saved = isNew ? await api.post<Item>(def.path, body) : await api.put<Item>(`${def.path}/${item!.id}`, body);
      toast(isNew ? 'Yaratildi' : 'Saqlandi');
      onSaved(saved);
    } catch (e) {
      setError(e);
      if (e instanceof ApiError && e.fields) {
        setErrs(e.fields);
        const bad = LANGS.find((l) => Object.keys(e.fields!).some((k) => k.endsWith('_' + l)));
        if (bad) setLang(bad);
      }
    } finally { setBusy(false); }
  };

  const hasI18n = i18nKeys.length > 0;
  return (
    <Drawer open={!!item} onClose={onClose} width={def.wide ? 860 : 680} title={isNew ? `Yangi: ${def.singular}` : def.titleOf(item ?? {})} sub={isNew ? undefined : `${def.singular} · #${item?.id}`}
      footer={<>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Yopish</button>
        <button type="button" className="btn btn--ink btn--sm" onClick={save} disabled={busy}>{busy && <span className="spinner" />}Saqlash</button>
      </>}>
      {hasI18n && (
        <div className="a-langbar">
          <LangTabs value={lang} onChange={setLang} filled={filled} errors={langErr} />
          <span className="a-muted">Tarjima bo‘sh qolsa saytda o‘zbekcha matn ko‘rsatiladi.</span>
        </div>
      )}
      <form className="a-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {def.fields.map((f) => <FieldInput key={f.key} f={f} form={form} lang={lang} set={set} errs={errs} />)}
        <button type="submit" hidden />
      </form>
      {error != null && <div style={{ marginTop: 16 }}><ErrorNotice error={error} compact /></div>}
      {!isNew && def.extra && <div className="a-extra">{def.extra(item!, () => onSaved(item!))}</div>}
    </Drawer>
  );
}

function FieldInput({ f, form, lang, set, errs }: { f: FieldDef; form: Item; lang: Lang; set: (k: string, v: unknown) => void; errs: Record<string, string> }) {
  const key = f.i18n ? `${f.key}_${lang}` : f.key;
  const val = form[key];
  const err = errs[key];
  const id = `f-${key}`;
  const label = <>{f.label}{f.i18n && <small className="a-lang-chip">{lang.toUpperCase()}</small>}{f.required && (!f.i18n || lang === 'uz') && <span style={{ color: 'var(--gold-ink)' }}> *</span>}</>;
  const wrap = (node: ReactNode) => (
    <div className={`field${f.span === 1 ? ' a-half' : ''}`}>
      {f.type !== 'bool' && <label className="field__label" htmlFor={id}><span>{label}</span></label>}
      {node}
      {err ? <span className="field__error">{err}</span> : f.help ? <span className="field__hint">{f.help}</span> : null}
    </div>
  );
  switch (f.type) {
    case 'textarea':
      return wrap(<textarea id={id} className="textarea" rows={f.rows ?? 4} value={String(val ?? '')} onChange={(e) => set(key, e.target.value)} placeholder={f.i18n && lang !== 'uz' ? String(form[`${f.key}_uz`] ?? '') : f.placeholder} />);
    case 'html':
      return wrap(<HtmlEditor id={id} value={String(val ?? '')} onChange={(v) => set(key, v)} />);
    case 'number':
      return wrap(<input id={id} className="input input--sm" type="number" step={f.step ?? 'any'} value={val === null || val === undefined ? '' : String(val)} onChange={(e) => set(key, e.target.value)} />);
    case 'bool':
      return <div className={`field${f.span === 1 ? ' a-half' : ''}`}><Toggle id={id} checked={!!val} onChange={(v) => set(key, v)} label={f.label} />{f.help && <span className="field__hint">{f.help}</span>}</div>;
    case 'select':
      return wrap(
        <select id={id} className="select select--sm" value={String(val ?? '')} onChange={(e) => set(key, e.target.value)}>
          {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>,
      );
    case 'date':
      return wrap(<input id={id} className="input input--sm" type="date" value={String(val ?? '').slice(0, 10)} onChange={(e) => set(key, e.target.value)} />);
    case 'time':
      return wrap(<input id={id} className="input input--sm" type="time" value={String(val ?? '').slice(0, 5)} onChange={(e) => set(key, e.target.value)} />);
    case 'datetime':
      return wrap(<input id={id} className="input input--sm" type="datetime-local" value={String(val ?? '').length === 16 ? String(val) : toLocalInput(val)} onChange={(e) => set(key, e.target.value)} />);
    case 'media': {
      const media = (form[`__media_${f.key}`] as AdminMedia | undefined) ?? (f.mediaKeys ?? []).map((k) => form[k] as AdminMedia | null).find(Boolean) ?? null;
      return (
        <div className={f.span === 1 ? 'a-half' : ''}>
          <MediaField label={f.label} value={val as number | null} media={media} isPrivate={f.private} accept={f.accept} hint={f.help}
            onChange={(idv, m) => { set(key, idv); set(`__media_${f.key}`, m); }} />
          {err && <span className="field__error">{err}</span>}
        </div>
      );
    }
    case 'custom':
      return <div className={f.span === 1 ? 'a-half' : ''}>{f.render!(form, set, errs)}</div>;
    default:
      return wrap(<input id={id} className="input input--sm" type={f.type === 'url' ? 'url' : 'text'} value={String(val ?? '')} onChange={(e) => set(key, e.target.value)} placeholder={f.i18n && lang !== 'uz' ? String(form[`${f.key}_uz`] ?? '') : f.placeholder} />);
  }
}

/* Minimal HTML editor: toolbar inserts tags; backend sanitises on save. */
function HtmlEditor({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const wrapSel = (before: string, after: string, placeholder = 'matn') => {
    const ta = ref.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); });
  };
  return (
    <div className="a-html">
      <div className="a-html__bar" role="toolbar" aria-label="Formatlash">
        <button type="button" onClick={() => wrapSel('<h2>', '</h2>', 'Sarlavha')} aria-label="Sarlavha"><Heading2 /></button>
        <button type="button" onClick={() => wrapSel('<strong>', '</strong>')} aria-label="Qalin"><Bold /></button>
        <button type="button" onClick={() => wrapSel('<em>', '</em>')} aria-label="Kursiv"><Italic /></button>
        <button type="button" onClick={() => wrapSel('<ul>\n  <li>', '</li>\n</ul>', 'band')} aria-label="Ro‘yxat"><List /></button>
        <button type="button" onClick={() => wrapSel('<blockquote>', '</blockquote>', 'iqtibos')} aria-label="Iqtibos"><Quote /></button>
        <button type="button" onClick={() => { const u = prompt('Havola (https://…)'); if (u) wrapSel(`<a href="${u}">`, '</a>', 'havola'); }} aria-label="Havola"><Link2 /></button>
        <button type="button" onClick={() => wrapSel('<p>', '</p>', 'Paragraf')} aria-label="Paragraf">¶</button>
        <span className="a-html__sp" />
        <button type="button" className={preview ? 'is-on' : ''} onClick={() => setPreview(!preview)} aria-pressed={preview}><Eye />Ko‘rish</button>
      </div>
      {preview
        ? <div className="prose a-html__preview" dangerouslySetInnerHTML={{ __html: value }} />
        : <textarea id={id} ref={ref} className="textarea a-mono" rows={12} value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
