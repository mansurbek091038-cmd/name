import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { FileCheck2, GraduationCap, MapPin, Plus } from 'lucide-react';
import { accentLast, Em, typo, useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import { money } from '@/lib/format';
import type { AdmissionBlocks, Faq, PageResponse, Price } from '@/lib/types';
import { PageHero, SectionHead } from '@/components/Blocks';
import { ErrorNotice, PageLoading, Skel } from '@/components/Feedback';
import { Reveal, RevealItem } from '@/components/Motion';
import { AdmissionForm } from '@/components/Forms';
import { TourBooking } from '@/components/TourBooking';
import '@/styles/pages.css';

export default function Admission() {
  const { t, lang } = useI18n();
  const page = useQuery<PageResponse<AdmissionBlocks>>('/public/pages/admission', { lang });
  const b = (page.data?.blocks ?? {}) as AdmissionBlocks & { title?: string; text?: string; documents_title?: string; faq_title?: string; prices_title?: string };
  useSeo({ title: page.data?.seo?.title || t.navAdmission, description: page.data?.seo?.description || t.admLead });

  if (page.loading && !page.data) return <PageLoading />;
  return (
    <>
      <PageHero eyebrow={t.ctaEyebrow} title={accentLast(b.title, lang) ?? t.admTitle} lead={typo(b.text, lang) || t.admLead}>
        <div className="hero__btns">
          <a href="#ariza" className="btn btn--gold btn--lg"><GraduationCap aria-hidden="true" />{t.apply}</a>
          <a href="#ekskursiya" className="btn btn--ghost btn--lg"><MapPin aria-hidden="true" />{t.tour}</a>
        </div>
      </PageHero>

      {page.error && <div className="container"><ErrorNotice error={page.error} onRetry={page.reload} /></div>}

      <section className="section section--top0" aria-labelledby="steps-h">
        <div className="container">
          <SectionHead eyebrow={t.stepsEyebrow} title={t.stepsTitle} id="steps-h" />
          <div className="adm-grid">
            <Reveal as="ol" className="steps" gap={0.1}>
              {page.loading && [0, 1, 2, 3].map((i) => <li key={i}><Skel h={150} r={22} /></li>)}
              {(b.steps ?? []).map((s, i) => (
                <RevealItem as="li" key={i} className="step">
                  <span className="step__n serif" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="step__title">{typo(s.title, lang)}</h3>
                  {s.text && <p>{typo(s.text, lang)}</p>}
                </RevealItem>
              ))}
            </Reveal>
            {!!b.documents?.length && (
              <Reveal className="card card--deep docs" gap={0.06}>
                <RevealItem><span className="icon-tile icon-tile--gold"><FileCheck2 aria-hidden="true" /></span></RevealItem>
                <RevealItem as="h3" className="h3">{typo(b.documents_title, lang) || t.docsTitle}</RevealItem>
                <ul className="docs__list">
                  {b.documents.map((d, i) => <RevealItem as="li" key={i}><span aria-hidden="true">{i + 1}</span>{d}</RevealItem>)}
                </ul>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      <Prices title={accentLast(b.prices_title, lang)} />
      <Faqs title={accentLast(b.faq_title, lang)} />

      <section className="section" id="ariza" aria-labelledby="form-h">
        <div className="container">
          <div className="form-card">
            <div className="form-card__head">
              <span className="eyebrow">{t.ctaEyebrow}</span>
              <h2 className="h2" id="form-h">{t.formTitle}</h2>
              <p className="lead">{t.formLead}</p>
            </div>
            <AdmissionForm idPrefix="page" />
          </div>
        </div>
      </section>

      <section className="section section--tight" id="ekskursiya" aria-labelledby="tours-h">
        <div className="container">
          <SectionHead eyebrow={t.toursEyebrow} title={t.toursTitle} lead={t.toursLead} id="tours-h" />
          <TourBooking />
        </div>
      </section>
    </>
  );
}

function Prices({ title }: { title?: string }) {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useQuery<Price[]>('/public/prices', { lang });
  const list = Array.isArray(data) ? data : [];
  if (!loading && !error && !list.length) return null;
  return (
    <section className="section band" aria-labelledby="prices-h">
      <div className="container">
        <SectionHead eyebrow={t.pricesEyebrow} title={title ?? t.pricesTitle} id="prices-h" />
        {error ? <ErrorNotice error={error} onRetry={reload} /> : (
          <Reveal className="prices" gap={0.08}>
            {loading && [0, 1, 2].map((i) => <Skel key={i} h={260} r={24} />)}
            {list.map((p, i) => (
              <RevealItem key={p.id} as="article" className={`price${i === 1 ? ' price--deep' : ''}`}>
                <span className="price__range">{p.grade_range}</span>
                <div className="price__main">
                  <b className="serif">{money(p.monthly_fee, t).replace(` ${t.sum}`, '')}</b>
                  <span>{t.sum} / {t.perMonth}</span>
                </div>
                <dl className="price__dl">
                  <div><dt>{t.mealsFee}</dt><dd>{p.meals_fee ? money(p.meals_fee, t) : t.included}</dd></div>
                  <div><dt>{t.transportFee}</dt><dd>{p.transport_fee ? money(p.transport_fee, t) : '—'}</dd></div>
                </dl>
                {p.note && <p className="price__note">{p.note}</p>}
              </RevealItem>
            ))}
          </Reveal>
        )}
      </div>
    </section>
  );
}

function Faqs({ title }: { title?: string }) {
  const { t, lang } = useI18n();
  const { data, error, reload } = useQuery<Faq[]>('/public/faqs', { lang });
  const list = Array.isArray(data) ? data : [];
  const [open, setOpen] = useState<number | null>(0);
  if (error) return <div className="container section"><ErrorNotice error={error} onRetry={reload} /></div>;
  if (!list.length) return null;
  return (
    <section className="section" aria-labelledby="faq-h">
      <div className="container faq">
        <div className="faq__head">
          <span className="eyebrow">{t.faqEyebrow}</span>
          <h2 className="h2" id="faq-h"><Em text={title ?? t.faqTitle} /></h2>
        </div>
        <div>
          {list.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.id} className="acc" data-open={isOpen}>
                <h3>
                  <button type="button" className="acc__btn" aria-expanded={isOpen} aria-controls={`faq-${f.id}`} onClick={() => setOpen(isOpen ? null : i)}>
                    <span>{f.question}</span><Plus aria-hidden="true" />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <m.div id={`faq-${f.id}`} initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.22, 0.8, 0.24, 1] }} style={{ overflow: 'hidden' }}>
                      <div className="acc__body">{f.answer}</div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
