/* Sections shared between Home and inner pages. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { m } from 'motion/react';
import { ArrowRight, CalendarDays, Clock, MapPin, Phone, Quote, Send } from 'lucide-react';
import { accentLast, typo, useI18n } from '@/lib/i18n';
import { useInView } from '@/lib/hooks';
import { useQuery } from '@/lib/query';
import { fmtDate, img, prettyPhone, telHref } from '@/lib/format';
import { gradeLabel } from '@/lib/format';
import type { ContactBlocks, PageResponse, Paged, Post, SiteSettings, Teacher, Testimonial } from '@/lib/types';
import { ErrorNotice, Skel } from './Feedback';
import { InstagramIcon } from './Icon';
import { Img, MapEmbed, SectionHead } from './Blocks';
import { fadeUp, Reveal, RevealItem } from './Motion';
import { handle, igHref, tgHref } from './Footer';

/** Mounts children only when close to the viewport (keeps first load light). */
export function Deferred({ children, minHeight = 400, id }: { children: ReactNode; minHeight?: number; id?: string }) {
  const [ref, near] = useInView<HTMLDivElement>({ rootMargin: '700px 0px', once: true });
  return <div ref={ref} id={id} style={near ? undefined : { minHeight }}>{near ? children : null}</div>;
}

/* ---------- teachers ---------- */
export function TeacherCard({ x }: { x: Teacher }) {
  const { t } = useI18n();
  return (
    <m.article className="teacher" variants={fadeUp}>
      <div className="teacher__photo">
        <Img src={x.photo} alt={x.full_name} sizes="(max-width: 640px) 50vw, 300px" />
        {x.badge && <span className="teacher__badge">{x.badge}</span>}
      </div>
      <h3 className="teacher__name serif">{x.full_name}</h3>
      {x.subject && <p className="teacher__subj">{x.subject}</p>}
      {x.experience_years ? <p className="teacher__exp"><b>{x.experience_years}</b> {t.yearsExp}</p> : null}
      {x.bio && <p className="teacher__bio">{x.bio}</p>}
    </m.article>
  );
}

export function TeachersGrid({ limit, showBio }: { limit?: number; showBio?: boolean }) {
  const { lang } = useI18n();
  const { data, error, loading, reload } = useQuery<Teacher[]>('/public/teachers', { lang });
  const list = (Array.isArray(data) ? data : []).slice(0, limit ?? 99);
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  return (
    <Reveal className={`teachers${showBio ? ' teachers--bio' : ''}`} gap={0.09}>
      {loading && [0, 1, 2, 3].map((i) => <div key={i}><Skel h={320} r={24} /><Skel h={22} w="70%" style={{ marginTop: 14 }} /></div>)}
      {list.map((x) => <TeacherCard key={x.id} x={showBio ? x : { ...x, bio: undefined }} />)}
    </Reveal>
  );
}

/* ---------- testimonials ---------- */
export function Testimonials({ title, lead }: { title?: string; lead?: string } = {}) {
  const { t, lang } = useI18n();
  const { data, error, reload } = useQuery<Testimonial[]>('/public/testimonials', { lang });
  const list = Array.isArray(data) ? data : [];
  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (!list.length) return null;
  return (
    <section className="section section--tight" id="fikrlar" aria-labelledby="reviews-h">
      <div className="container">
        <SectionHead eyebrow={t.reviewsEyebrow} title={title ?? t.reviewsTitle} lead={lead || undefined} id="reviews-h" />
        <Reveal className="reviews" gap={0.1}>
          {list.slice(0, 6).map((r, i) => (
            <RevealItem key={r.id} as="article" className={`review${i === 1 ? ' review--deep' : ''}`}>
              <Quote className="review__q" aria-hidden="true" />
              <p className="review__text serif">{typo(r.text, lang)}</p>
              <footer className="review__by">
                <span className="review__av" aria-hidden="true">
                  {img(r.photo, 'thumb') ? (
                    <img src={img(r.photo, 'thumb')} alt={r.author} />
                  ) : (
                    r.author.split(/\s+/).map((s) => s[0]).slice(0, 2).join('')
                  )}
                </span>
                <div>
                  <b>{r.author}</b>
                  {r.child_name ? (
                    <small>{lang === 'ru' ? `Ученик: ${r.child_name}` : lang === 'en' ? `Student: ${r.child_name}` : `Farzandi: ${r.child_name}`}</small>
                  ) : r.child_grade ? (
                    <small>{/^\d+$/.test(String(r.child_grade)) ? gradeLabel(r.child_grade, t, lang) : r.child_grade}</small>
                  ) : null}
                </div>
                {r.date && <span className="review__date">{fmtDate(r.date, lang)}</span>}
              </footer>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- news ---------- */
export function NewsCard({ p, big, h2 }: { p: Post; big?: boolean; h2?: boolean }) {
  const H = h2 ? 'h2' : 'h3';
  const { t, to, lang } = useI18n();
  const isEvent = p.type === 'event';
  return (
    <m.article className={`news-card${big ? ' news-card--big' : ''}`} variants={fadeUp}>
      <Link to={to(`/yangiliklar/${p.slug}`)} className="news-card__link">
        <div className="news-card__img"><Img src={p.cover} alt="" sizes={big ? '(max-width: 900px) 100vw, 640px' : '(max-width: 900px) 100vw, 420px'} /></div>
        <div className="news-card__body">
          <div className="news-card__meta">
            <span className={`tag ${isEvent ? 'tag--gold' : 'tag--soft'}`}>{isEvent ? t.typeEvent : t.typeNews}</span>
            <span><CalendarDays aria-hidden="true" />{fmtDate(isEvent && p.event_date ? p.event_date : p.published_at, lang)}</span>
          </div>
          <H className="news-card__title serif">{p.title}</H>
          {p.excerpt && <p className="news-card__ex">{p.excerpt}</p>}
          <span className="btn btn--text">{t.readMore}<ArrowRight aria-hidden="true" /></span>
        </div>
      </Link>
    </m.article>
  );
}

export function NewsPreview({ title }: { title?: string } = {}) {
  const { t, to, lang } = useI18n();
  const { data, error, loading, reload } = useQuery<Paged<Post>>('/public/posts', { lang, page: 1, page_size: 3 });
  const items = data?.items ?? [];
  return (
    <section className="section" aria-labelledby="news-h">
      <div className="container">
        <SectionHead eyebrow={t.newsEyebrow} title={title ?? t.newsTitle} id="news-h"
          aside={<Link className="btn btn--ghost" to={to('/yangiliklar')}>{t.allNews}<ArrowRight aria-hidden="true" /></Link>} />
        {error ? <ErrorNotice error={error} onRetry={reload} /> : (
          <Reveal className="news-grid" gap={0.1}>
            {loading && [0, 1, 2].map((i) => <Skel key={i} h={380} r={24} />)}
            {items.map((p) => <NewsCard key={p.id} p={p} />)}
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ---------- contact ---------- */
export function useContact() {
  const { lang } = useI18n();
  const page = useQuery<PageResponse<ContactBlocks>>('/public/pages/contact', { lang });
  const settings = useQuery<SiteSettings>('/public/settings');
  const b = (page.data?.blocks ?? {}) as ContactBlocks & { title?: string; text?: string };
  const s = settings.data ?? {};
  const hours = s.working_hours || (s.work_hours_weekday ? (s.work_hours_saturday ? `${s.work_hours_weekday}, ${s.work_hours_saturday}` : s.work_hours_weekday) : b.hours);
  return {
    title: accentLast(b.title, lang),
    text: typo(b.text, lang),
    loading: page.loading,
    error: page.error,
    reload: page.reload,
    seo: page.data?.seo,
    address: b.address || s.address,
    phones: b.phones?.length ? b.phones : s.phone ? [s.phone] : [],
    telegram: b.telegram || s.telegram,
    instagram: b.instagram || s.instagram,
    hours,
    map: b.map_embed_url,
    lat: typeof b.lat === 'number' ? b.lat : undefined,
    lng: typeof b.lng === 'number' ? b.lng : undefined,
  };
}

export function ContactCards() {
  const { t } = useI18n();
  const c = useContact();
  if (c.error) return <ErrorNotice error={c.error} onRetry={c.reload} />;
  const rows: { icon: ReactNode; label: string; value: ReactNode; key: string }[] = [];
  if (c.address) rows.push({ key: 'a', icon: <MapPin />, label: t.address, value: c.address });
  if (c.phones.length) rows.push({ key: 'p', icon: <Phone />, label: t.phone, value: c.phones.map((p) => <a key={p} href={telHref(p)}>{prettyPhone(p)}</a>) });
  if (c.telegram) rows.push({ key: 't', icon: <Send />, label: t.telegram, value: <a href={tgHref(c.telegram)} target="_blank" rel="noopener">{handle(c.telegram)}</a> });
  if (c.instagram) rows.push({ key: 'i', icon: <InstagramIcon />, label: t.instagram, value: <a href={igHref(c.instagram)} target="_blank" rel="noopener">{handle(c.instagram)}</a> });
  if (c.hours) rows.push({ key: 'h', icon: <Clock />, label: t.hours, value: c.hours });
  return (
    <Reveal as="ul" className="contact-list" gap={0.07}>
      {c.loading && [0, 1, 2, 3].map((i) => <li key={i}><Skel h={64} r={18} /></li>)}
      {rows.map((r) => (
        <RevealItem as="li" key={r.key} className="contact-item">
          <span className="icon-tile icon-tile--soft" aria-hidden="true">{r.icon}</span>
          <div><span className="contact-item__lbl">{r.label}</span><div className="contact-item__val">{r.value}</div></div>
        </RevealItem>
      ))}
    </Reveal>
  );
}

export function ContactSection() {
  const { t } = useI18n();
  const c = useContact();
  return (
    <section className="section" id="aloqa" aria-labelledby="contact-h">
      <div className="container">
        <SectionHead eyebrow={t.contactEyebrow} title={c.title ?? t.contactTitle} lead={c.text || t.contactLead} id="contact-h" />
        <div className="contact-grid">
          <ContactCards />
          <MapEmbed url={c.map} lat={c.lat} lng={c.lng} address={c.address} />
        </div>
      </div>
    </section>
  );
}

/** Highlights the schedule slot that is happening now (Tashkent time). */
export function useNowSlot(times: string[]): number {
  const [idx, setIdx] = useState(-1);
  const mins = useMemo(() => times.map((x) => { const [h, mm] = x.split(':').map(Number); return h * 60 + (mm || 0); }), [times]);
  useEffect(() => {
    const calc = () => {
      const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tashkent' }));
      const cur = now.getHours() * 60 + now.getMinutes();
      const day = now.getDay();
      let k = -1;
      if (day !== 0) mins.forEach((v, i) => { if (cur >= v) k = i; });
      if (k === mins.length - 1 && cur > mins[k] + 120) k = -1;
      setIdx(k);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [mins]);
  return idx;
}
