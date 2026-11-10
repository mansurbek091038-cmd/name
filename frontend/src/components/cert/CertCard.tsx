import { m } from 'motion/react';
import { BadgeCheck, Star } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { img } from '@/lib/format';
import type { Certificate } from '@/lib/types';
import { fadeUp } from '../Motion';
import { certMeta, isOlymp, scoreText, typeLabel, subRows } from './certUtils';
import '@/styles/cert.css';

export function CertCard({ c, onOpen }: { c: Certificate; onOpen: (c: Certificate) => void }) {
  const { t, lang } = useI18n();
  const src = img(c.image, 'medium');
  const subs = subRows(c, t);
  return (
    <m.article className="cert-card" variants={fadeUp} layout="position">
      <button type="button" className="cert-card__btn" onClick={() => onOpen(c)}>
        <span className="sr-only">{t.viewCert}: </span>
        <div className="cert-card__img">
          {src ? <img src={src} alt="" loading="lazy" decoding="async" width={400} height={530} /> : <div className="cert-card__ph" />}
          <span className={`tag ${c.is_featured ? 'tag--gold' : ''}`}>{c.is_featured && <Star aria-hidden="true" />}{typeLabel(c.type, t)}</span>
          {c.is_new && <span className="tag tag--green cert-card__new">{t.newBadge}</span>}
        </div>
        <div className="cert-card__body">
          <div className="cert-card__score">
            <span className="serif">{scoreText(c, t)}</span>
            {!isOlymp(c.type) && <small>{typeLabel(c.type, t)}</small>}
            <BadgeCheck className="cert-card__ok" aria-label={t.verified} />
          </div>
          <b className="cert-card__name">{c.student_name}</b>
          <span className="cert-card__meta">{certMeta(c, t, lang)}{isOlymp(c.type) && c.subject ? ` · ${c.subject}` : ''}</span>
          {subs.length > 0 && (
            <div className="cert-card__subs">
              {subs.slice(0, 4).map((s) => <span key={s.key}>{s.short}<b>{s.value}</b></span>)}
            </div>
          )}
        </div>
      </button>
    </m.article>
  );
}
