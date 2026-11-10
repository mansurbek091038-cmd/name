import { useEffect, useRef, useState } from 'react';
import { m, useInView, useReducedMotion } from 'motion/react';
import { Star } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { img } from '@/lib/format';
import type { Certificate } from '@/lib/types';
import { tagText } from './certUtils';

// object (not label) animate props so the cards never inherit a parent's reveal variants
const HIDDEN = { opacity: 0, y: 90, rotateZ: 0, rotateY: 0, x: 0, z: 0, scale: 1 };

/** 3D fan of real certificate cards; spreads on hover, lifts the hovered card. */
export function CertFan({ items, onOpen }: { items: Certificate[]; onOpen: (c: Certificate) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [spread, setSpread] = useState(false);
  const [hot, setHot] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const seen = useInView(ref, { once: true, amount: 0.25 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const max = w < 420 ? 3 : w < 640 ? 4 : 5;
  const list = items.slice(0, max);
  const n = list.length;
  const cardW = w < 420 ? 140 : w < 640 ? 168 : 218;
  const cardH = Math.round(cardW * 1.32);
  const mid = (n - 1) / 2;
  const room = Math.max(0, w - cardW - 16);
  const base = n > 1 ? Math.min(cardW * 0.78, room / (n - 1)) * 0.86 : 0;
  const wide = n > 1 ? Math.min(cardW * 1.02, room / (n - 1)) : 0;

  return (
    <div
      ref={ref}
      className="fan"
      style={{ height: cardH + 40 }}
      onMouseEnter={() => setSpread(true)}
      onMouseLeave={() => { setSpread(false); setHot(null); }}
    >
      {list.map((c, i) => {
        const o = i - mid;
        const isHot = hot === i;
        const sp = spread && !reduce;
        const x = o * (sp ? wide : base);
        const target = {
          opacity: 1,
          x,
          y: Math.abs(o) * (sp ? 4 : 16) - (isHot ? 26 : 0) - (o === 0 && !sp ? 10 : 0),
          rotateZ: o * (sp ? 1.5 : 5),
          rotateY: -o * (sp ? 5 : 15),
          z: isHot ? 90 : -Math.abs(o) * 34 + (o === 0 ? 40 : 0),
          scale: isHot ? 1.05 : 1,
        };
        const src = img(c.image, 'thumb') ?? img(c.image, 'medium');
        return (
          <m.button
            key={c.id}
            type="button"
            className="fan__card"
            style={{ width: cardW, height: cardH, marginLeft: -cardW / 2, zIndex: isHot ? 50 : 20 - Math.round(Math.abs(o) * 2) }}
            initial={reduce ? false : HIDDEN}
            animate={seen || reduce ? target : HIDDEN}
            transition={{ type: 'spring', stiffness: 210, damping: 24, mass: 0.9, delay: spread ? 0 : 0.05 * i }}
            onMouseEnter={() => setHot(i)}
            onFocus={() => { setSpread(true); setHot(i); }}
            onBlur={() => setHot(null)}
            onClick={() => onOpen(c)}
          >
            <span className="sr-only">{t.viewCert}: </span>
            {src ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} /> : <span className="fan__ph" />}
            <span className={`tag ${c.is_featured && o === 0 ? 'tag--gold' : ''}`}>{c.is_featured && o === 0 && <Star aria-hidden="true" />}{tagText(c, t)}</span>
            <span className="fan__name">{c.student_name}</span>
          </m.button>
        );
      })}
    </div>
  );
}
