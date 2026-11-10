import { Link, useLocation, useSearchParams } from 'react-router';
import { m, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Home as HomeIco } from 'lucide-react';
import { accentLast, Em, typo, useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import type { PageResponse } from '@/lib/types';
import '@/styles/pages.css';

interface ThanksBlocks { title?: string; text?: string; steps?: (string | { title?: string; text?: string })[]; [k: string]: unknown }

export default function Thanks() {
  const { t, to, lang } = useI18n();
  const loc = useLocation();
  const [sp] = useSearchParams();
  const number = (loc.state as { number?: string } | null)?.number ?? sp.get('n') ?? '';
  const { data, loading } = useQuery<PageResponse<ThanksBlocks>>('/public/pages/thanks', { lang });
  const b = data?.blocks ?? {};
  const reduce = useReducedMotion();
  useSeo({ title: t.thanksTitle.replace(/<\/?em>/g, ''), noindex: true });
  const steps = (b.steps?.length ? b.steps.map((s) => (typeof s === 'string' ? s : s.title ?? '')) : [t.thanksStep1, t.thanksStep2, t.thanksStep3]).filter(Boolean);

  if (loading && !data) return <div className="page-loading" />;
  return (
    <section className="section thanks">
      <div className="container">
        <m.div className="thanks__card" initial={reduce ? false : { opacity: 0, y: 40, rotateX: 10 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.9, ease: [0.22, 0.8, 0.24, 1] }}>
          <div className="thanks__seal" aria-hidden="true">
            <m.img src="/brand/logo-384.webp" alt="" width={140} height={140} initial={reduce ? false : { rotate: -40, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 12, delay: 0.2 }} />
            <m.span className="thanks__check" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.7 }}><Check /></m.span>
          </div>
          <h1 className="h2"><Em text={accentLast(b.title, lang) ?? t.thanksTitle} /></h1>
          <p className="lead">{typo(b.text, lang) || t.thanksText}</p>
          {number && (
            <div className="thanks__num">
              <small>{t.appNumber}</small>
              <b className="serif">{number}</b>
            </div>
          )}
          <h2 className="thanks__h">{t.whatNext}</h2>
          <ol className="thanks__steps">
            {steps.map((s, i) => <li key={i}><span className="serif">{i + 1}</span>{s}</li>)}
          </ol>
          <div className="thanks__btns">
            <Link to={to('/')} className="btn btn--ghost btn--lg"><HomeIco aria-hidden="true" />{t.backHome}</Link>
            <Link to={to('/natijalar')} className="btn btn--ink btn--lg">{t.navResults}<ArrowRight aria-hidden="true" /></Link>
          </div>
        </m.div>
      </div>
    </section>
  );
}
