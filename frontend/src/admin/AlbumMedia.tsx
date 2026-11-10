import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { img } from '@/lib/format';
import type { Paged } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { uploadMedia, type AdminMedia } from './MediaField';
import { useConfirm } from './ui';

/** Album photos: multi-upload (drag & drop), alt text, reorder, delete. */
export function AlbumMedia({ albumId }: { albumId: number }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, reload } = useQuery<Paged<AdminMedia>>('/admin/media', { album_id: albumId, page_size: 100 });
  const items = data?.items ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const refresh = () => { invalidate('/admin/media'); invalidate('/admin/albums'); invalidate('/public/albums'); reload(); };

  const upload = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setProgress({ done: 0, total: list.length });
    let ok = 0;
    for (const f of list) {
      try { await uploadMedia(f, { album_id: albumId }); ok++; } catch (e) { toast(`${f.name}: ${(e as Error).message}`, 'error'); }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setProgress(null);
    if (ok) toast(`${ok} ta rasm yuklandi`);
    refresh();
  };
  const setAlt = async (m: AdminMedia, alt: string) => {
    if (alt === (m.alt_uz ?? '')) return;
    try { await api.put(`/admin/media/${m.id}`, { alt_uz: alt }); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const move = async (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    try {
      // rewrite the order of every photo so the sequence stays stable
      await Promise.all(next.map((m, k) => (m.order === k ? null : api.put(`/admin/media/${m.id}`, { order: k }))));
      refresh();
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  const remove = async (m: AdminMedia) => {
    if (!(await confirm('Rasm o‘chirilsinmi?', { danger: true, ok: 'O‘chirish' }))) return;
    try { await api.del(`/admin/media/${m.id}`); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div>
      <h3 className="a-subh">Albom rasmlari <small className="a-muted">· {items.length} ta</small></h3>
      <div className={`a-drop${drag ? ' is-drag' : ''}`} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}>
        <ImagePlus />
        <p><b>Rasmlarni shu yerga tashlang</b> yoki</p>
        <button type="button" className="btn btn--ink btn--xs" onClick={() => input.current?.click()} disabled={!!progress}>Tanlash</button>
        {progress && <span className="a-muted">Yuklanmoqda: {progress.done}/{progress.total}</span>}
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      </div>
      {error && <ErrorNotice error={error} onRetry={reload} compact />}
      <div className="a-gallery">
        {items.map((m, i) => (
          <figure key={m.id} className="a-gallery__item">
            <img src={img(m, 'thumb')} alt={m.alt_uz ?? ''} loading="lazy" />
            <input className="input input--sm" placeholder="Alt matn (uz)" defaultValue={m.alt_uz ?? ''} onBlur={(e) => setAlt(m, e.target.value)} aria-label="Alt matn" />
            <div className="a-gallery__btns">
              <button type="button" className="icon-btn" aria-label="Chapga" disabled={i === 0} onClick={() => move(i, -1)}><ArrowLeft /></button>
              <button type="button" className="icon-btn" aria-label="O‘ngga" disabled={i === items.length - 1} onClick={() => move(i, 1)}><ArrowRight /></button>
              <button type="button" className="icon-btn a-danger-text" aria-label="O‘chirish" onClick={() => remove(m)}><Trash2 /></button>
            </div>
          </figure>
        ))}
      </div>
    </div>
  );
}
