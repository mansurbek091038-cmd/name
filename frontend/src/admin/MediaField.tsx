import { useRef, useState } from 'react';
import { FileText, ImagePlus, Lock, Trash2, Upload } from 'lucide-react';
import { api } from '@/lib/api';
import { img } from '@/lib/format';
import type { Media } from '@/lib/types';
import { useToast } from '@/components/Feedback';

export type AdminMedia = Media & { order?: number; is_private?: boolean; mime?: string; original_name?: string; original_url?: string; size?: number; album_id?: number | null; alt_uz?: string; alt_ru?: string; alt_en?: string };

export async function uploadMedia(file: File, opts: { private?: boolean; album_id?: number; alt_uz?: string } = {}): Promise<AdminMedia> {
  const fd = new FormData();
  fd.append('file', file);
  if (opts.private) fd.append('private', 'true');
  if (opts.album_id) fd.append('album_id', String(opts.album_id));
  if (opts.alt_uz) fd.append('alt_uz', opts.alt_uz);
  return api.upload<AdminMedia>('/admin/media', fd);
}

/** Pick/upload one image or file; stores the media id. */
export function MediaField({ value, media, onChange, isPrivate, accept = 'image/*', label, hint }: {
  value: number | null | undefined; media?: AdminMedia | null; onChange: (id: number | null, m: AdminMedia | null) => void;
  isPrivate?: boolean; accept?: string; label: string; hint?: string;
}) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const isImage = !media?.mime || media.mime.startsWith('image/');
  const preview = media ? img(media, 'thumb') ?? img(media, 'medium') : undefined;

  const handle = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try { const m = await uploadMedia(file, { private: isPrivate }); onChange(m.id, m); toast('Fayl yuklandi'); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };

  return (
    <div className="field">
      <span className="field__label">{label}{isPrivate && <small><Lock size={12} /> yopiq saqlanadi</small>}</span>
      <div className={`a-media${drag ? ' is-drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]); }}>
        <div className="a-media__prev">
          {value && preview && isImage ? <img src={preview} alt="" /> : value ? <FileText /> : <ImagePlus />}
        </div>
        <div className="a-media__info">
          {value ? <b>{media?.original_name || `#${value}`}</b> : <b>Fayl tanlanmagan</b>}
          <small>{hint ?? 'Faylni shu yerga tashlang yoki tanlang'}</small>
          <div className="a-media__btns">
            <button type="button" className="btn btn--ghost btn--xs" onClick={() => input.current?.click()} disabled={busy}>{busy ? <span className="spinner" /> : <Upload />}{value ? 'Almashtirish' : 'Yuklash'}</button>
            {value ? <button type="button" className="btn btn--ghost btn--xs a-danger-text" onClick={() => onChange(null, null)}><Trash2 />Olib tashlash</button> : null}
          </div>
        </div>
        <input ref={input} type="file" accept={accept} hidden onChange={(e) => handle(e.target.files?.[0])} />
      </div>
    </div>
  );
}
