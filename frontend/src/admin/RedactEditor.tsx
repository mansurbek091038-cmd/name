import { useRef, useState } from 'react';
import { Eraser, Trash2 } from 'lucide-react';
import { img } from '@/lib/format';
import type { AdminMedia } from './MediaField';

type Item = Record<string, unknown>;
interface Region { x: number; y: number; w: number; h: number }
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** Draw rectangles over the original certificate image; those areas are blurred/masked in the public copy. */
export function RedactEditor({ form, set }: { form: Item; set: (k: string, v: unknown) => void }) {
  const regions = (form.redact_regions ?? []) as Region[];
  const media = (form.__media_image_id as AdminMedia | undefined) ?? (form.original_image as AdminMedia | null) ?? (form.image as AdminMedia | null);
  const src = media ? img(media, 'medium') : undefined;
  const box = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Region | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  if (!form.image_id || !src) return null;

  const pt = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };
  return (
    <div className="field">
      <span className="field__label">Yashiriladigan joylar <small>sertifikat raqami, QR-kod va h.k. ustiga to‘rtburchak chizing</small></span>
      <div className="a-redact">
        <div ref={box} className="a-redact__img"
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); start.current = pt(e); setDraft({ ...start.current, w: 0, h: 0 }); }}
          onPointerMove={(e) => { if (!start.current) return; const p = pt(e); const s = start.current; setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) }); }}
          onPointerUp={() => {
            if (draft && draft.w > 0.01 && draft.h > 0.005) set('redact_regions', [...regions, { x: +draft.x.toFixed(4), y: +draft.y.toFixed(4), w: +draft.w.toFixed(4), h: +draft.h.toFixed(4) }]);
            start.current = null; setDraft(null);
          }}>
          <img src={src} alt="Sertifikat (asl nusxa)" draggable={false} />
          {regions.map((r, i) => <span key={i} className="a-redact__box" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}>{i + 1}</span>)}
          {draft && <span className="a-redact__box a-redact__box--draft" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />}
        </div>
        <div className="a-redact__list">
          {regions.length === 0 && <p className="a-muted">Hech narsa yashirilmaydi. Rasm ustida sichqoncha bilan chizing.</p>}
          {regions.map((r, i) => (
            <div key={i} className="a-redact__row">
              <b>#{i + 1}</b><span className="a-mono">{Math.round(r.w * 100)}×{Math.round(r.h * 100)}%</span>
              <button type="button" className="icon-btn a-danger-text" aria-label="O‘chirish" onClick={() => set('redact_regions', regions.filter((_, j) => j !== i))}><Trash2 /></button>
            </div>
          ))}
          {regions.length > 0 && <button type="button" className="btn btn--ghost btn--xs" onClick={() => set('redact_regions', [])}><Eraser />Hammasini tozalash</button>}
          <p className="field__hint">Saqlangandan so‘ng saytdagi nusxa qayta yaratiladi.</p>
        </div>
      </div>
    </div>
  );
}
