import { useSearchParams } from 'react-router';
import { m } from 'motion/react';
import { useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import type { Paged, Post } from '@/lib/types';
import { PageHero } from '@/components/Blocks';
import { Empty, ErrorNotice, Skel } from '@/components/Feedback';
import { stagger } from '@/components/Motion';
import { NewsCard } from '@/components/sections';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import '@/styles/pages.css';

export default function News() {
  const { t, lang } = useI18n();
  const [sp, setSp] = useSearchParams();
  const type = sp.get('type') ?? '';
  const page = Number(sp.get('page') ?? '1') || 1;
  useSeo({ title: t.navNews, description: t.newsPageLead });
  const { data, error, loading, reload } = useQuery<Paged<Post>>('/public/posts', { lang, type, page, page_size: 9 }, { keepPrevious: true });
  const items = data?.items ?? [];
  const go = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHero eyebrow={t.newsEyebrow} title={t.newsPageTitle} lead={t.newsPageLead}>
        <div className="chips" role="group" aria-label={t.navNews}>
          {[['', t.all], ['news', t.typeNews], ['event', t.typeEvent]].map(([v, l]) => (
            <button key={v} type="button" className="chip" aria-pressed={type === v} onClick={() => go('type', v)}>{l}</button>
          ))}
        </div>
      </PageHero>
      <section className="section section--top0">
        <div className="container">
          {error ? <ErrorNotice error={error} onRetry={reload} /> : !loading && !items.length ? <Empty title={t.emptyTitle} /> : (
            <m.div className="news-grid news-grid--page" key={`${type}-${page}`} variants={stagger(0.07)} initial="hidden" animate="show">
              {loading && !items.length && [0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={380} r={24} />)}
              {items.map((p, i) => <NewsCard key={p.id} p={p} h2 big={i === 0 && page === 1} />)}
            </m.div>
          )}
          {data && data.pages > 1 && (
            <nav className="pager" aria-label="Pagination">
              <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => go('page', String(page - 1))} aria-label={t.prev}><ChevronLeft /></button>
              {Array.from({ length: data.pages }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className="pager__n" aria-current={n === page ? 'page' : undefined} onClick={() => go('page', String(n))}>{n}</button>
              ))}
              <button type="button" className="icon-btn" disabled={page >= data.pages} onClick={() => go('page', String(page + 1))} aria-label={t.next}><ChevronRight /></button>
            </nav>
          )}
        </div>
      </section>
    </>
  );
}
