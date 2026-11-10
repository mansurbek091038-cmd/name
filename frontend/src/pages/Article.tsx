import { Link, useParams } from 'react-router';
import { m } from 'motion/react';
import { ArrowLeft, CalendarDays, Clock, Link2, MapPin, Send } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import { fmtDate, img, readingTime } from '@/lib/format';
import type { Paged, Post } from '@/lib/types';
import { Img } from '@/components/Blocks';
import { ErrorNotice, Skel, useToast } from '@/components/Feedback';
import { Reveal } from '@/components/Motion';
import { NewsCard } from '@/components/sections';
import NotFound from './NotFound';
import '@/styles/pages.css';

export default function Article() {
  const { slug = '' } = useParams();
  const { t, to, lang } = useI18n();
  const toast = useToast();
  const { data: p, error, loading, reload } = useQuery<Post & { event_location?: string }>(`/public/posts/${encodeURIComponent(slug)}`, { lang });
  const { data: more } = useQuery<Paged<Post>>('/public/posts', { lang, page: 1, page_size: 4 });
  useSeo({ title: p?.seo?.title || p?.title, description: p?.seo?.description || p?.excerpt, image: img(p?.cover, 'large') });

  if (error?.status === 404) return <NotFound />;
  const related = (more?.items ?? []).filter((x) => x.slug !== slug).slice(0, 3);
  const isEvent = p?.type === 'event';
  const share = async () => { try { await navigator.clipboard.writeText(location.href); toast(t.linkCopied); } catch { /* ignore */ } };

  return (
    <article className="article">
      <div className="container article__head">
        <Link to={to('/yangiliklar')} className="btn btn--text"><ArrowLeft aria-hidden="true" />{t.allNews}</Link>
        {error ? <ErrorNotice error={error} onRetry={reload} /> : loading || !p ? (
          <div style={{ marginTop: 24 }}><Skel h={56} w="80%" /><Skel h={56} w="60%" style={{ marginTop: 12 }} /></div>
        ) : (
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="article__meta">
              <span className={`tag ${isEvent ? 'tag--gold' : 'tag--soft'}`}>{isEvent ? t.typeEvent : t.typeNews}</span>
              <span><CalendarDays aria-hidden="true" />{fmtDate(p.published_at, lang)}</span>
              <span><Clock aria-hidden="true" />{readingTime(p.body)} {t.minutesRead}</span>
            </div>
            <h1 className="h1 article__title">{p.title}</h1>
            {p.excerpt && <p className="lead article__lead">{p.excerpt}</p>}
            {isEvent && p.event_date && (
              <div className="article__event">
                <CalendarDays aria-hidden="true" /><span><small>{t.eventDate}</small><b>{fmtDate(p.event_date, lang)}</b></span>
                {p.event_location && <><MapPin aria-hidden="true" /><span><b>{p.event_location}</b></span></>}
              </div>
            )}
          </m.div>
        )}
      </div>
      {p?.cover && (
        <m.div className="container article__cover" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: [0.22, 0.8, 0.24, 1] }}>
          <Img src={p.cover} eager sizes="(max-width: 1200px) 100vw, 1100px" alt={p.title} />
        </m.div>
      )}
      {p && (
        <div className="container article__body">
          <div className="prose" dangerouslySetInnerHTML={{ __html: p.body ?? '' }} />
          <aside className="article__share">
            <span>{t.share}</span>
            <a className="icon-btn" href={`https://t.me/share/url?url=${encodeURIComponent(location.href)}&text=${encodeURIComponent(p.title)}`} target="_blank" rel="noopener" aria-label="Telegram"><Send aria-hidden="true" /></a>
            <button type="button" className="icon-btn" onClick={share} aria-label={t.copyLink}><Link2 aria-hidden="true" /></button>
          </aside>
        </div>
      )}
      {related.length > 0 && (
        <section className="section" aria-labelledby="rel-h">
          <div className="container">
            <h2 className="h3" id="rel-h" style={{ marginBottom: 24 }}>{t.related}</h2>
            <Reveal className="news-grid" gap={0.08}>{related.map((x) => <NewsCard key={x.id} p={x} />)}</Reveal>
          </div>
        </section>
      )}
    </article>
  );
}
