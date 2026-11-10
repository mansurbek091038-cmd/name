import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { ChevronLeft, ChevronRight, ExternalLink, MapPin, X } from 'lucide-react';
import { Em, useI18n } from '@/lib/i18n';
import { useDialog, useInView, useLockBody } from '@/lib/hooks';
import { img, srcSet, alt as altOf } from '@/lib/format';
import type { ImageRef, Media } from '@/lib/types';
import { Reveal, RevealItem } from './Motion';

export function SectionHead({ eyebrow, title, lead, center, aside, id }: { eyebrow: string; title: string; lead?: string; center?: boolean; aside?: ReactNode; id?: string }) {
  return (
    <Reveal className={`section-head${center ? ' section-head--center' : ''}`}>
      <div className="section-head__text">
        <RevealItem><span className="eyebrow">{eyebrow}</span></RevealItem>
        <RevealItem as="h2" className="h2"><span id={id}><Em text={title} /></span></RevealItem>
        {lead && <RevealItem as="p" className="lead">{lead}</RevealItem>}
      </div>
      {aside && <RevealItem>{aside}</RevealItem>}
    </Reveal>
  );
}

/** Inner-page hero: eyebrow, Lora title with gold accent, lead, and the arch motif. */
export function PageHero({ eyebrow, title, lead, children, image }: { eyebrow: string; title: string; lead?: string; children?: ReactNode; image?: ImageRef }) {
  return (
    <section className="page-hero">
      <div className="container page-hero__in">
        <Reveal className="page-hero__text" gap={0.09}>
          <RevealItem><span className="eyebrow">{eyebrow}</span></RevealItem>
          <RevealItem as="h1" className="h1 page-hero__title"><Em text={title} /></RevealItem>
          {lead && <RevealItem as="p" className="lead">{lead}</RevealItem>}
          {children && <RevealItem className="page-hero__extra">{children}</RevealItem>}
        </Reveal>
        <div className="page-hero__art" aria-hidden="true">
          <div className="page-hero__ring" />
          {image ? (
            <m.div className="page-hero__arch" initial={{ opacity: 0, rotateY: -24, y: 30 }} animate={{ opacity: 1, rotateY: -12, y: 0 }} transition={{ duration: 1, ease: [0.22, 0.8, 0.24, 1] }}>
              <img src={img(image, 'medium')} alt="" />
            </m.div>
          ) : (
            <m.div className="page-hero__seal" initial={{ opacity: 0, rotate: -20, scale: 0.8 }} animate={{ opacity: 1, rotate: 8, scale: 1 }} transition={{ duration: 1.1, ease: [0.22, 0.8, 0.24, 1] }}>
              <img src="/brand/logo-384.webp" alt="" width={190} height={190} />
            </m.div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Responsive image from a media object. */
export function Img({ src, className, sizes, eager, alt, width, height }: { src: ImageRef; className?: string; sizes?: string; eager?: boolean; alt?: string; width?: number; height?: number }) {
  const s = img(src, 'medium');
  if (!s) return <div className={`img-ph ${className ?? ''}`} />;
  const media = typeof src === 'object' ? (src as Media) : null;
  return (
    <img
      className={className}
      src={s}
      srcSet={srcSet(src)}
      sizes={sizes}
      alt={alt ?? altOf(src)}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      fetchPriority={eager ? 'high' : undefined}
      width={width ?? media?.width ?? undefined}
      height={height ?? media?.height ?? undefined}
    />
  );
}

/* ---------- map (iframe mounted only when visible; never blocks first paint) ---------- */
export function MapEmbed({ url, lat, lng, address }: { url?: string; lat?: number; lng?: number; address?: string }) {
  const { t } = useI18n();
  const [ref, near] = useInView<HTMLDivElement>({ rootMargin: '300px', once: true });
  const [load, setLoad] = useState(false);
  useEffect(() => { if (near) { const id = setTimeout(() => setLoad(true), 400); return () => clearTimeout(id); } }, [near]);
  const yandex = lat && lng ? `https://yandex.uz/maps/?pt=${lng},${lat}&z=16&l=map` : `https://yandex.uz/maps/?text=${encodeURIComponent(address ?? 'Smart Start Toshkent')}`;
  const google = lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address ?? 'Smart Start Tashkent')}`;
  return (
    <div ref={ref} className="map">
      <div className="map__ph">
        <span className="map__pin"><MapPin aria-hidden="true" /></span>
        {address && <p>{address}</p>}
        {url && !load && <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLoad(true)}>{t.showMap}</button>}
      </div>
      {url && load && <iframe src={url} title={t.openMap} loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />}
      <div className="map__links">
        <a className="btn btn--ghost btn--xs" href={yandex} target="_blank" rel="noopener">Yandex <ExternalLink aria-hidden="true" /></a>
        <a className="btn btn--ghost btn--xs" href={google} target="_blank" rel="noopener">Google <ExternalLink aria-hidden="true" /></a>
      </div>
    </div>
  );
}

/* ---------- lightbox ---------- */
export function Lightbox({ items, index, onClose, onIndex }: { items: Media[]; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const open = index !== null && !!items[index];
  useLockBody(open);
  return createPortal(
    <AnimatePresence>{open && <LbInner items={items} index={index!} onClose={onClose} onIndex={onIndex} />}</AnimatePresence>,
    document.body,
  );
}
function LbInner({ items, index, onClose, onIndex }: { items: Media[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [dir, setDir] = useState(0);
  useDialog(true, onClose, ref);
  const go = (d: number) => { const n = (index + d + items.length) % items.length; setDir(d); onIndex(n); };
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });
  const it = items[index];
  const touch = useRef<number | null>(null);
  return (
    <m.div ref={ref} className="lightbox" role="dialog" aria-modal="true" aria-label={it.alt ?? ''} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); touch.current = null; }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <button type="button" className="lightbox__close icon-btn icon-btn--dark" onClick={onClose} aria-label={t.close} data-autofocus><X /></button>
      <button type="button" className="lightbox__nav lightbox__nav--prev icon-btn icon-btn--dark" onClick={() => go(-1)} aria-label={t.prev}><ChevronLeft /></button>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.figure key={it.id ?? index} className="lightbox__fig" initial={{ opacity: 0, x: dir * 80, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -dir * 80 }} transition={{ duration: 0.35, ease: [0.22, 0.8, 0.24, 1] }}>
          <img src={img(it, 'large')} alt={it.alt ?? ''} />
          {it.alt && <figcaption>{it.alt}</figcaption>}
        </m.figure>
      </AnimatePresence>
      <button type="button" className="lightbox__nav lightbox__nav--next icon-btn icon-btn--dark" onClick={() => go(1)} aria-label={t.next}><ChevronRight /></button>
      <div className="lightbox__count">{index + 1} / {items.length}</div>
    </m.div>
  );
}
