import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { m } from 'motion/react';
import { ArrowRight, Lock, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '@/lib/api';
import { accentLast, Em, typo, useI18n } from '@/lib/i18n';
import { useDebounced } from '@/lib/hooks';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import type { Certificate, CertStats, PageResponse, Paged } from '@/lib/types';
import { PageHero } from '@/components/Blocks';
import { Empty, ErrorNotice, PageLoading, Skel } from '@/components/Feedback';
import { Counter, stagger } from '@/components/Motion';
import { CertCard } from '@/components/cert/CertCard';
import { CertModal } from '@/components/cert/CertModal';
import { CERT_TYPES, typeLabel } from '@/components/cert/certUtils';
import '@/styles/pages.css';

const PAGE = 12;

export default function Results() {
  const { t, lang, to } = useI18n();
  const [sp, setSp] = useSearchParams();
  const { data: pageData, error: pageError } = useQuery<PageResponse<{ title?: string; text?: string; privacy_note?: string; cta_title?: string; cta_button?: string; stats_labels?: Record<string, string> }>>('/public/pages/results', { lang });
  const pb = pageData?.blocks ?? {};
  const type = sp.get('type') ?? 'all';
  const year = sp.get('year') ?? '';
  const grade = sp.get('grade') ?? '';
  const sort = sp.get('sort') ?? 'new';
  const [q, setQ] = useState(sp.get('q') ?? '');
  const dq = useDebounced(q.trim(), 350);
  const certParam = sp.get('cert');
  useSeo({ title: pageData?.seo?.title || t.navResults, description: pageData?.seo?.description || pb.text || t.resultsPageLead, image: pageData?.seo?.og_image });

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (!v || v === 'all' || (k === 'sort' && v === 'new')) n.delete(k); else n.set(k, v);
    n.delete('cert');
    setSp(n, { replace: true, preventScrollReset: true });
  };
  useEffect(() => { if ((sp.get('q') ?? '') !== dq) set('q', dq); /* eslint-disable-next-line */ }, [dq]);

  const { data: stats } = useQuery<CertStats>('/public/certificates/stats');

  // paged loading with "load more"
  const [items, setItems] = useState<Certificate[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const filterKey = `${type}|${year}|${grade}|${sort}|${dq}|${lang}`;
  const lastKey = useRef(filterKey);

  useEffect(() => {
    const changed = lastKey.current !== filterKey;
    lastKey.current = filterKey;
    const p = changed ? 1 : page;
    if (changed && page !== 1) { setPage(1); return; }
    const ac = new AbortController();
    setLoading(true); setError(null);
    api.get<Paged<Certificate>>('/public/certificates', { type, year, grade, sort, search: dq, page: p, page_size: PAGE, lang }, ac.signal)
      .then((r) => {
        setItems((s) => (p === 1 ? r.items : [...s, ...r.items.filter((x) => !s.some((y) => y.id === x.id))]));
        setTotal(r.total); setPages(r.pages);
      })
      .catch((e) => { if ((e as Error).name !== 'AbortError') setError(e); })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [filterKey, page, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  // modal (deep-linkable via ?cert=)
  const [extra, setExtra] = useState<Certificate | null>(null);
  const idx = useMemo(() => (certParam ? items.findIndex((x) => String(x.id) === certParam) : -1), [certParam, items]);
  useEffect(() => {
    if (!certParam || idx >= 0 || loading) return;
    api.get<Certificate>(`/public/certificates/${certParam}`, { lang }).then(setExtra).catch(() => set('cert', ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certParam, idx, loading]);
  const modalList = idx >= 0 ? items : extra ? [extra] : [];
  const modalIndex = idx >= 0 ? idx : extra && certParam === String(extra.id) ? 0 : null;
  const openCert = (c: Certificate, replace = false) => { const n = new URLSearchParams(sp); n.set('cert', String(c.id)); setSp(n, { preventScrollReset: true, replace }); };
  const closeCert = () => { const n = new URLSearchParams(sp); n.delete('cert'); setSp(n, { replace: true, preventScrollReset: true }); setExtra(null); };

  const thisYear = new Date().getFullYear();
  if (!pageData && !pageError) return <PageLoading />;
  const years = Array.from({ length: thisYear - 2021 }, (_, i) => thisYear - i);
  const hasFilters = type !== 'all' || year || grade || dq || sort !== 'new';

  return (
    <>
      <PageHero eyebrow={t.resultsEyebrow} title={accentLast(pb.title, lang) ?? t.resultsPageTitle} lead={typo(pb.text, lang) || t.resultsPageLead}>
        <div className="hero-stats">
          {[
            { v: stats?.ielts_7_plus, l: pb.stats_labels?.ielts_7_plus || t.statIelts },
            { v: stats?.cefr_b2_c1, l: pb.stats_labels?.cefr_b2_c1 || t.statCefr },
            { v: stats?.sat_1300_plus, l: pb.stats_labels?.sat_1300_plus || t.statSat },
            { v: stats?.olympiad_winners, l: pb.stats_labels?.olympiad_winners || t.statOlymp },
          ].map((s, i) => (
            <div key={i} className="hero-stat"><b className="serif">{s.v === undefined ? '—' : <Counter value={s.v} />}</b><small>{s.l}</small></div>
          ))}
        </div>
      </PageHero>

      <section className="section section--top0">
        <div className="container">
          <div className="filterbar card" role="search">
            <div className="filterbar__row">
              <div className="chips" role="group" aria-label={t.certType}>
                {['all', ...CERT_TYPES].map((x) => (
                  <button key={x} type="button" className="chip" aria-pressed={type === x} onClick={() => set('type', x)}>
                    {x === 'all' ? t.all : typeLabel(x, t)}
                  </button>
                ))}
              </div>
            </div>
            <div className="filterbar__row filterbar__grid">
              <label className="input-icon filterbar__search">
                <span className="sr-only">{t.search}</span>
                <Search aria-hidden="true" />
                <input className="input" type="search" placeholder={t.searchPh} value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              <label className="filterbar__sel"><span className="sr-only">{t.year}</span>
                <select className="select" value={year} onChange={(e) => set('year', e.target.value)}>
                  <option value="">{t.allYears}</option>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="filterbar__sel"><span className="sr-only">{t.gradeLabel}</span>
                <select className="select" value={grade} onChange={(e) => set('grade', e.target.value)}>
                  <option value="">{t.allGrades}</option>
                  {[5, 6, 7, 8, 9, 10, 11].map((g) => <option key={g} value={g}>{g}{t.gradeShort}</option>)}
                </select>
              </label>
              <label className="filterbar__sel"><span className="sr-only">{t.sort}</span>
                <select className="select" value={sort} onChange={(e) => set('sort', e.target.value)}>
                  <option value="new">{t.sortNew}</option>
                  <option value="top">{t.sortTop}</option>
                  <option value="name">{t.sortName}</option>
                </select>
              </label>
            </div>
            <div className="filterbar__foot">
              {pb.privacy_note && <span className="filterbar__privacy"><Lock aria-hidden="true" />{typo(pb.privacy_note, lang)}</span>}
              <span className="filterbar__count" aria-live="polite"><SlidersHorizontal aria-hidden="true" /><b>{total}</b> {t.found}</span>
              {hasFilters && (
                <button type="button" className="btn btn--text" onClick={() => { setQ(''); const n = new URLSearchParams(); if (sp.get('lang')) n.set('lang', sp.get('lang')!); setSp(n, { replace: true }); }}>
                  <X aria-hidden="true" />{t.clearFilters}
                </button>
              )}
            </div>
          </div>

          {error != null && <div style={{ marginTop: 24 }}><ErrorNotice error={error} onRetry={() => setNonce((n) => n + 1)} /></div>}

          {!error && !loading && items.length === 0 ? (
            <Empty title={t.emptyTitle} text={t.emptyText} />
          ) : (
            <m.div className="cert-grid" variants={stagger(0.05)} initial="hidden" animate="show" key={filterKey}>
              {items.map((c) => <CertCard key={c.id} c={c} onOpen={(x) => openCert(x)} />)}
              {loading && Array.from({ length: page === 1 ? 8 : 4 }, (_, i) => <div key={'s' + i}><Skel h={300} r={22} /></div>)}
            </m.div>
          )}

          {page < pages && !loading && items.length > 0 && (
            <div className="loadmore">
              <button type="button" className="btn btn--ghost btn--lg" onClick={() => setPage((p) => p + 1)}>
                {t.loadMore} <small className="muted">({total - items.length} {t.remaining})</small>
              </button>
            </div>
          )}
          <div className="strip-cta" style={{ marginTop: 56 }}>
            <p className="serif"><Em text={accentLast(pb.cta_title, lang) ?? t.footerCta} /></p>
            <Link to={to('/qabul') + '#ariza'} className="btn btn--gold btn--lg">{pb.cta_button || t.apply}<ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
      <CertModal items={modalList} index={modalIndex} onClose={closeCert} onIndex={(i) => openCert(modalList[i], true)} />
    </>
  );
}
