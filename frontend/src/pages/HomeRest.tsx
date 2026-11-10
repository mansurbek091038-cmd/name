import { useState } from 'react';
import { Link } from 'react-router';
import { m } from 'motion/react';
import { ArrowRight, Check, MapPin, Phone } from 'lucide-react';
import { accentLast, Em, typo, useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { prettyPhone, telHref } from '@/lib/format';
import type { AdmissionBlocks, Certificate, CertStats, HomeBlocks, PageResponse, Paged } from '@/lib/types';
import { DynIcon } from '@/components/Icon';
import { Counter, fadeUp, Reveal, RevealItem } from '@/components/Motion';
import { ErrorNotice, Skel } from '@/components/Feedback';
import { Img, SectionHead } from '@/components/Blocks';
import { AdmissionForm } from '@/components/Forms';
import { TourBooking } from '@/components/TourBooking';
import { PartnersGlobe } from '@/components/PartnersGlobe';
import { CertFan } from '@/components/cert/CertFan';
import { CertModal } from '@/components/cert/CertModal';
import { typeLabel, CERT_TYPES } from '@/components/cert/certUtils';
import { ContactSection, Deferred, NewsPreview, TeachersGrid, Testimonials, useContact, useNowSlot } from '@/components/sections';
import { warm } from '@/routes';


export default function HomeRest({ b, T, L }: { b: HomeBlocks; T: (k: string, fb: string) => string; L: (k: string, fb: string) => string }) {
  const { t, to } = useI18n();
  return (
    <>
      <Why items={b.why} title={T('why_title', t.whyTitle)} lead={L('why_subtitle', t.whyLead)} />
      <ResultsAndPartners eyebrow={L('results_title', t.resultsEyebrow)} />
      <Stages items={b.stages} title={T('stages_title', t.stagesTitle)} lead={L('stages_text', t.stagesLead)} />
      <Day items={b.day} eyebrow={L('day_badge', t.dayEyebrow)} title={T('day_title', t.dayTitle)} lead={L('day_text', t.dayLead)} />
      <Deferred minHeight={600}>
        <section className="section" aria-labelledby="teachers-h">
          <div className="container">
            <SectionHead eyebrow={t.teachersEyebrow} title={T('teachers_title', t.teachersTitle)} lead={L('teachers_text', t.teachersLead)} id="teachers-h"
              aside={<Link className="btn btn--ghost" to={to('/oqituvchilar')} onMouseEnter={() => warm('/oqituvchilar')}>{t.allTeachers}<ArrowRight aria-hidden="true" /></Link>} />
            <TeachersGrid limit={4} />
          </div>
        </section>
      </Deferred>
      <Deferred minHeight={420}><Testimonials title={T('testimonials_title', t.reviewsTitle)} lead={L('testimonials_text', '')} /></Deferred>
      <Deferred minHeight={520}><NewsPreview title={T('news_title', t.newsTitle)} /></Deferred>
      <AdmissionCta cta={b.cta} />
      <Deferred minHeight={400}>
        <section className="section section--tight" id="ekskursiya" aria-labelledby="tours-h">
          <div className="container">
            <SectionHead eyebrow={t.toursEyebrow} title={t.toursTitle} lead={t.toursLead} id="tours-h" />
            <TourBooking />
          </div>
        </section>
      </Deferred>
      <Deferred minHeight={500}><ContactSection /></Deferred>
    </>
  );
}

/* ================= WHY (bento) ================= */
function Why({ items, title, lead }: { items?: HomeBlocks['why']; title: string; lead: string }) {
  const { t, to, lang } = useI18n();
  const list = items ?? [];
  if (!list.length) return null;
  return (
    <section className="section" id="about" aria-labelledby="why-h">
      <div className="container">
        <SectionHead eyebrow={t.whyEyebrow} title={title} lead={lead} id="why-h" />
        <Reveal className={`bento bento--${Math.min(list.length, 6)}`} gap={0.07}>
          {list.slice(0, 6).map((w, i) => (
            <RevealItem key={i} as="article" className={`bento__item bento__item--${i + 1}`}>
              <span className="bento__num serif" aria-hidden="true" data-n={String(i + 1).padStart(2, '0')} />
              <span className={`icon-tile${i === 0 ? ' icon-tile--gold' : ''}`}><DynIcon name={w.icon} /></span>
              <h3 className="bento__title serif">{typo(w.title, lang)}</h3>
              <p className="bento__text">{w.text}</p>
              {i === list.length - 1 && list.length >= 6 && (
                <Link className="btn btn--text bento__link" to={to('/natijalar')}>{t.allCerts}<ArrowRight aria-hidden="true" /></Link>
              )}
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ================= RESULTS + GLOBE ================= */
function ResultsAndPartners({ eyebrow }: { eyebrow: string }) {
  const { t, to } = useI18n();
  const [type, setType] = useState<string>('all');
  const q = type === 'all' ? { featured: true, sort: 'top', page_size: 8 } : { type, sort: 'top', page_size: 8 };
  const { data, error, loading, reload } = useQuery<Paged<Certificate>>('/public/certificates', q, { keepPrevious: true });
  const { data: stats } = useQuery<CertStats>('/public/certificates/stats');
  const items = data?.items ?? [];
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="section section--results" aria-labelledby="res-h">
      <div className="container">
        <div className="duo">
          <Reveal className="card results-card" amount={0.15}>
            <RevealItem><span className="eyebrow">{eyebrow}</span></RevealItem>
            <RevealItem as="h2" className="h2"><span id="res-h"><Em text={t.resultsTitle} /></span></RevealItem>
            <RevealItem className="results-card__filters">
              <div className="chips" role="group" aria-label={t.certType}>
                {['all', ...CERT_TYPES.filter((x) => x !== 'boshqa')].map((x) => (
                  <button key={x} type="button" className="chip" aria-pressed={type === x} onClick={() => setType(x)}>{x === 'all' ? t.all : typeLabel(x, t)}</button>
                ))}
              </div>
              <Link to={to('/natijalar')} className="btn btn--text" onMouseEnter={() => warm('/natijalar')}>{t.verify}<ArrowRight aria-hidden="true" /></Link>
            </RevealItem>
            <div className="results-card__fan">
              {error ? <ErrorNotice error={error} onRetry={reload} compact /> : loading && !items.length ? <Skel h={240} r={20} /> : (
                <CertFan key={type} items={items} onOpen={(c) => setOpen(items.indexOf(c))} />
              )}
            </div>
          </Reveal>
          <PartnersGlobe />
        </div>

        <Reveal className="cert-stats" gap={0.08}>
          {[
            { v: stats?.ielts_7_plus, l: t.statIelts },
            { v: stats?.cefr_b2_c1, l: t.statCefr },
            { v: stats?.sat_1300_plus, l: t.statSat },
            { v: stats?.olympiad_winners, l: t.statOlymp },
          ].map((s, i) => (
            <RevealItem key={i} className="cert-stat">
              <b className="serif">{s.v === undefined ? '—' : <><Counter value={s.v} /><span className="suf">+</span></>}</b>
              <small>{s.l}</small>
            </RevealItem>
          ))}
          <RevealItem className="cert-stat cert-stat--link">
            <Link to={to('/natijalar')} onMouseEnter={() => warm('/natijalar')}>
              <b className="serif">{stats?.total ?? '—'}</b>
              <small>{t.statTotal}</small>
              <ArrowRight aria-hidden="true" />
            </Link>
          </RevealItem>
        </Reveal>
      </div>
      <CertModal items={items} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </section>
  );
}

/* ================= STAGES ================= */
function Stages({ items, title, lead }: { items?: HomeBlocks['stages']; title: string; lead: string }) {
  const { t, lang } = useI18n();
  const list = items ?? [];
  if (!list.length) return null;
  return (
    <section className="section" id="stages" aria-labelledby="stages-h">
      <div className="container">
        <SectionHead eyebrow={t.stagesEyebrow} title={title} lead={lead} id="stages-h" />
        <Reveal className="stages" gap={0.12}>
          {list.map((s, i) => (
            <m.article key={s.key ?? i} className="stage" variants={fadeUp}>
              <div className="stage__img">
                <Img src={s.image} alt={s.title} sizes="(max-width: 900px) 92vw, 420px" />
                <span className="stage__no serif" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="stage__body">
                <div className="stage__tags">
                  {s.grades && <span className="tag" title={s.badge}>{s.grades}</span>}
                  {s.ages && <span className="tag tag--outline">{s.ages}</span>}
                </div>
                <h3 className="h3">{typo(s.title, lang)}</h3>
                {s.text && <p className="stage__text">{s.text}</p>}
                {!!s.points?.length && (
                  <ul className="checks">
                    {s.points.map((p, k) => <li key={k}><Check aria-hidden="true" />{p}</li>)}
                  </ul>
                )}
              </div>
            </m.article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ================= DAY ================= */
function Day({ items, eyebrow, title, lead }: { items?: HomeBlocks['day']; eyebrow: string; title: string; lead: string }) {
  const { t } = useI18n();
  const list = items ?? [];
  const now = useNowSlot(list.map((x) => x.time));
  if (!list.length) return null;
  return (
    <section className="section band" aria-labelledby="day-h">
      <div className="container">
        <SectionHead eyebrow={eyebrow} title={title} lead={lead} id="day-h"
          aside={<a className="btn btn--ink" href="#ekskursiya"><MapPin aria-hidden="true" />{t.tour}</a>} />
        <div className="day">
          <m.div className="day__line" aria-hidden="true" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 1.6, ease: [0.22, 0.8, 0.24, 1] }} />
          <Reveal as="ol" className="day__list" gap={0.12} amount={0.3}>
            {list.map((d, i) => (
              <RevealItem as="li" key={i} className={`day__item${i === now ? ' is-now' : ''}`}>
                <span className="day__dot" aria-hidden="true" />
                <time className="day__time serif">{d.time}</time>
                {i === now && <span className="tag tag--gold day__now">{t.now}</span>}
                <h3 className="day__title">{d.title}</h3>
                {d.text && <p className="day__text">{d.text}</p>}
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ================= ADMISSION CTA ================= */
function AdmissionCta({ cta }: { cta?: HomeBlocks['cta'] }) {
  const { t, lang } = useI18n();
  const { data } = useQuery<PageResponse<AdmissionBlocks>>('/public/pages/admission', { lang });
  const steps = data?.blocks?.steps ?? [];
  const c = useContact();
  return (
    <section className="section" id="ariza" aria-labelledby="cta-h">
      <div className="container">
        <div className="cta-card">
          <Reveal className="cta-card__text" gap={0.08}>
            <RevealItem><span className="eyebrow">{t.ctaEyebrow}</span></RevealItem>
            <RevealItem as="h2" className="h2"><span id="cta-h"><Em text={accentLast(cta?.title, lang) ?? t.formTitle} /></span></RevealItem>
            {cta?.text && <RevealItem as="p" className="lead">{cta.text}</RevealItem>}
            {steps.length > 0 && (
              <ol className="cta-steps">
                {steps.slice(0, 4).map((s, i) => (
                  <RevealItem as="li" key={i}>
                    <span className="cta-steps__n serif">{i + 1}</span>
                    <span><b>{s.title}</b>{s.text && <small>{s.text}</small>}</span>
                  </RevealItem>
                ))}
              </ol>
            )}
            {c.phones[0] && (
              <RevealItem>
                <a className="cta-phone" href={telHref(c.phones[0])}><Phone aria-hidden="true" />{prettyPhone(c.phones[0])}</a>
              </RevealItem>
            )}
          </Reveal>
          <m.div className="cta-card__form" initial={{ opacity: 0, y: 40, rotateX: 8 }} whileInView={{ opacity: 1, y: 0, rotateX: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.8, ease: [0.22, 0.8, 0.24, 1] }}>
            <h3 className="h3">{t.formTitle}</h3>
            <p className="muted" style={{ marginTop: 6, marginBottom: 20, fontWeight: 600 }}>{t.formLead}</p>
            <AdmissionForm compact idPrefix="home" submitLabel={cta?.button} />
          </m.div>
        </div>
      </div>
    </section>
  );
}
