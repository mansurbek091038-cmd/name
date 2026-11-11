import { lazy, Suspense, useRef } from 'react';
import { Link } from 'react-router';
import { m, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { BadgeCheck, BookOpen, Globe2, GraduationCap } from 'lucide-react';
import { accentLast, AccentTitle, typo, useI18n } from '@/lib/i18n';
import { useMedia } from '@/lib/hooks';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import { img, prettyPhone, telHref } from '@/lib/format';
import type { Certificate, HomeBlocks, PageResponse, Paged } from '@/lib/types';
import { Counter, Reveal, RevealItem } from '@/components/Motion';
import { ErrorNotice, Skel } from '@/components/Feedback';
import { Img } from '@/components/Blocks';
import { subRows, typeLabel } from '@/components/cert/certUtils';
import { useContact } from '@/components/sections';
import { warm } from '@/routes';


const HomeRest = lazy(() => import('./HomeRest'));

export default function Home() {
  const { lang, t } = useI18n();
  const { data, error, loading, reload } = useQuery<PageResponse<HomeBlocks>>('/public/pages/home', { lang });
  const b = data?.blocks ?? {};
  const sec = (b.sections ?? {}) as Record<string, string>;
  const T = (k: string, fb: string) => accentLast(sec[k], lang) ?? fb;
  const L = (k: string, fb: string) => typo(sec[k], lang) || fb;
  useSeo({ title: data?.seo?.title || t.schoolName, description: data?.seo?.description || b.hero?.text, image: data?.seo?.og_image || img(b.hero?.image, 'large') });

  if (error && !data) {
    return <div className="container section"><ErrorNotice error={error} onRetry={reload} /></div>;
  }
  return (
    <>
      <Hero b={b} loading={loading} />
      <StatsRibbon stats={b.stats} loading={loading} />
      <Suspense fallback={<div style={{ minHeight: 1200 }} />}>
        <HomeRest b={b} T={T} L={L} />
      </Suspense>
    </>
  );
}

/* ================= HERO ================= */
function Hero({ b, loading }: { b: HomeBlocks; loading: boolean }) {
  const { t, to, lang } = useI18n();
  const h = b.hero ?? {};
  const ref = useRef<HTMLElement>(null);
  // a static shell (index.html) already painted the hero: don't replay entrance animations over it
  const shell = typeof window !== 'undefined' && !!(window as Window & { __SS_SHELL?: boolean }).__SS_SHELL;
  const reduce = useReducedMotion();
  const desktop = useMedia('(min-width: 1024px) and (pointer: fine)');
  const wide = useMedia('(min-width: 1024px)');
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], reduce ? ['0%', '0%'] : ['-4%', '12%']);
  const archY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 40]);
  const cardsY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -90]);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 120, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 120, damping: 18, mass: 0.6 });
  const rY = useTransform(sx, [-0.5, 0.5], [-9, 9]);
  const rX = useTransform(sy, [-0.5, 0.5], [7, -7]);
  const tilt = desktop && !reduce;

  const { data: certs } = useQuery<Paged<Certificate>>('/public/certificates', { type: 'IELTS', sort: 'top', page_size: 1 });
  const { data: anyCert } = useQuery<Paged<Certificate>>(certs && !certs.items?.length ? '/public/certificates' : null, { sort: 'top', page_size: 1 });
  const cert = certs?.items?.[0] ?? anyCert?.items?.[0];
  const students = b.stats?.[0];
  const phone = useContact().phones[0];

  return (
    <section ref={ref} className="hero" aria-labelledby="hero-title">
      <div className="hero__glow" aria-hidden="true" />
      <div className="container hero__in">
        <Reveal className="hero__text" gap={0.1} instant={shell}>
          <RevealItem>
            <span className="pill-badge"><span className="pill-badge__dot">{t.ctaEyebrow}</span>{loading ? <Skel w={200} h={14} /> : typo(h.admission_open || h.badge, lang)}</span>
          </RevealItem>
          <RevealItem as="h1" className="h1 hero__title">
            <span id="hero-title">{loading ? <><Skel h="0.92em" w="95%" /><Skel h="0.92em" w="80%" style={{ marginTop: '0.1em' }} /><Skel h="0.92em" w="60%" style={{ marginTop: '0.1em' }} /></> : <AccentTitle title={h.title} accent={h.title_accent} lang={lang} />}</span>
          </RevealItem>
          <RevealItem as="p" className="lead hero__lead">{loading ? <><Skel h="1.1em" /><Skel h="1.1em" w="90%" style={{ marginTop: 6 }} /><Skel h="1.1em" w="70%" style={{ marginTop: 6 }} /></> : typo(h.text, lang)}</RevealItem>
          <RevealItem className="hero__btns">
            <Link to={to('/qabul') + '#ariza'} className="btn btn--gold btn--lg" onMouseEnter={() => warm('/qabul')}><GraduationCap aria-hidden="true" />{h.cta_primary || t.apply}</Link>
            <a href="#kurslar" className="btn btn--ghost btn--lg"><BookOpen aria-hidden="true" />{t.courses}</a>
          </RevealItem>
          {h.motto && <RevealItem as="p" className="hero__motto serif">{typo(h.motto, lang)}</RevealItem>}
          {h.questions && <RevealItem as="p" className="hero__q">{typo(h.questions, lang)} {phone ? <a href={telHref(phone)}>{prettyPhone(phone)}</a> : <a href="#aloqa">&nbsp;</a>}</RevealItem>}
        </Reveal>

        <div
          className="hero__stage"
          onPointerMove={(e) => {
            if (!tilt) return;
            const r = e.currentTarget.getBoundingClientRect();
            mx.set((e.clientX - r.left) / r.width - 0.5);
            my.set((e.clientY - r.top) / r.height - 0.5);
          }}
          onPointerLeave={() => { mx.set(0); my.set(0); }}
        >
          <m.div className="hero__rig" style={tilt ? { rotateX: rX, rotateY: rY } : undefined}>
            <div className="hero__ring" aria-hidden="true" />
            <m.div className="hero__arch" style={{ y: archY }} initial={reduce || shell ? false : { rotateY: wide ? -28 : 0, rotateX: 0, x: 30, scale: 0.97 }} animate={{ rotateY: wide ? -14 : 0, rotateX: wide ? 3 : 0, x: 0, scale: 1 }} transition={{ duration: 1.2, ease: [0.22, 0.8, 0.24, 1] }}>
              <div className="hero__archclip">
                {h.image ? (
                  <m.div className="hero__archimg" style={{ y: imgY }}>
                    <Img src={h.image} eager sizes="(max-width: 1024px) 92vw, 560px" alt={h.photo_caption || (typeof h.image === 'object' && h.image?.alt ? h.image.alt : t.schoolName)} />
                  </m.div>
                ) : <div className="hero__archimg skel" />}
              </div>
            </m.div>

            <m.div className="hero__float" style={{ y: cardsY }}>
              <m.div className="hero__seal" initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -30 }} animate={{ opacity: 1, scale: 1, rotate: 8 }} transition={{ delay: 0.5, type: 'spring', stiffness: 140, damping: 14 }}>
                <img src="/brand/logo-384.webp" srcSet="/brand/logo-192.webp 192w, /brand/logo-384.webp 384w" sizes="(max-width: 1023px) 90px, 150px" alt="" width={150} height={150} />
              </m.div>
              {students && (
                <m.div className="fc fc--ppl" initial={reduce ? false : { opacity: 0, y: 20, rotateZ: 3 }} animate={{ opacity: 1, y: 0, rotateZ: 3, z: 40 }} transition={{ delay: 0.7, duration: 0.6 }}>
                  <span className="fc__av" aria-hidden="true"><i /><i /><i /></span>
                  <span><b>{students.value}{students.suffix}</b> {t.studentsWithUs}</span>
                </m.div>
              )}
              {cert && <HeroCert c={cert} reduce={!!reduce} wide={wide} />}
              <m.div className="fc fc--uni" initial={reduce ? false : { opacity: 0, y: 20, rotateZ: -2 }} animate={{ opacity: 1, y: 0, z: 60, rotateZ: -2 }} transition={{ delay: 1.0, duration: 0.6 }}>
                <span className="fc__g" aria-hidden="true"><Globe2 /></span>
                <span><b>{t.topUni}</b><small>{t.topUniSub}</small></span>
              </m.div>
            </m.div>
          </m.div>
        </div>
      </div>
    </section>
  );
}

function HeroCert({ c, reduce, wide }: { c: Certificate; reduce: boolean; wide: boolean }) {
  const { t } = useI18n();
  const subs = subRows(c, t).slice(0, 4);
  return (
    <m.div className="fc fc--cert" initial={reduce ? false : { opacity: 0, y: 30, rotateZ: -6 }} animate={wide ? { opacity: 1, y: 0, rotateY: 18, rotateX: 6, rotateZ: -6, z: 80 } : { opacity: 1, y: 0, rotateZ: -5 }} transition={{ delay: 0.85, duration: 0.7 }}>
      <div className="fc--cert__t"><span>{typeLabel(c.type, t)}{c.year ? ` · ${c.year}` : ''}</span><BadgeCheck aria-label={t.verified} /></div>
      <div className="fc--cert__sc serif">{String(c.score)}<small>{t.overall}</small></div>
      <div className="fc--cert__nm">{c.student_name}{c.grade ? ` · ${c.grade}${t.gradeShort}` : ''}</div>
      {subs.length > 0 && <div className="fc--cert__sub">{subs.map((s) => <span key={s.key}>{s.short}<b>{s.value}</b></span>)}</div>}
    </m.div>
  );
}

/* ================= STATS ================= */
function StatsRibbon({ stats, loading }: { stats?: HomeBlocks['stats']; loading: boolean }) {
  const list = stats ?? [];
  return (
    <section className="container" aria-label="Smart Start">
      <Reveal className="stats" gap={0.08}>
        {loading && !list.length && [0, 1, 2, 3, 4].map((i) => <div key={i} className="st"><Skel h={44} w={110} style={{ opacity: 0.12 }} /></div>)}
        {list.map((s, i) => {
          const year = /^\d{4}$/.test(String(s.value)) && !s.suffix;
          return (
            <RevealItem key={i} className={`st${year ? ' st--year' : ''}`}>
              <b className="serif"><Counter value={s.value} />{s.suffix && <span className="suf">{s.suffix}</span>}</b>
              <small>{s.label}</small>
            </RevealItem>
          );
        })}
      </Reveal>
    </section>
  );
}

