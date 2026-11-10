import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { Em, typo, useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import type { PageResponse, Partner } from '@/lib/types';
import type { Globe } from '@/three/globe';
import { ErrorNotice, Skel } from './Feedback';

export function Flag({ code }: { code?: string }) {
  const c = (code ?? '').toUpperCase();
  return <span className={`flag flag--${c}`} aria-hidden="true">{c && !KNOWN.has(c) ? c : ''}</span>;
}
const KNOWN = new Set(['DE', 'IT', 'FR', 'PL', 'KR', 'JP', 'GB', 'UK', 'US', 'TR', 'RU', 'UZ', 'KZ', 'CN', 'HU', 'NL', 'AT', 'MY', 'CZ', 'LT', 'LV', 'CA', 'SG', 'ES', 'CH']);

/** Navy card: partner list + lazily-loaded three.js globe (paused when offscreen). */
export function PartnersGlobe({ compact = false }: { compact?: boolean }) {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useQuery<Partner[]>('/public/partners', { lang });
  const partners = (Array.isArray(data) ? data : []).filter(Boolean);
  const { data: page } = useQuery<PageResponse<{ text?: string }>>(compact ? null : '/public/pages/partners', { lang });
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const globe = useRef<Globe | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();

  // load three.js only when the card approaches the viewport; pause rendering when offscreen
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let disposed = false;
    let visible = false;
    const io = new IntersectionObserver(async ([e]) => {
      visible = e.isIntersecting;
      if (visible && !globe.current && canvas.current) {
        const mod = await import('@/three/globe');
        if (disposed || !canvas.current) return;
        try {
          globe.current = new mod.Globe(canvas.current, { reduceMotion: !!reduce });
        } catch {
          return; // WebGL unavailable → static fallback stays
        }
        const r = canvas.current.getBoundingClientRect();
        globe.current.resize(r.width, r.height);
        setReady(true);
      }
      if (globe.current) { if (visible && document.visibilityState === 'visible') globe.current.start(); else globe.current.stop(); }
    }, { rootMargin: '200px 0px' });
    io.observe(el);
    const onVis = () => { if (!globe.current) return; if (document.visibilityState === 'visible' && visible) globe.current.start(); else globe.current.stop(); };
    document.addEventListener('visibilitychange', onVis);
    const ro = new ResizeObserver(() => {
      const r = canvas.current?.getBoundingClientRect();
      if (r && globe.current) globe.current.resize(r.width, r.height);
    });
    if (canvas.current) ro.observe(canvas.current);
    return () => { disposed = true; io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); globe.current?.dispose(); globe.current = null; };
  }, [reduce]);

  const withCoords = partners.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number');
  useEffect(() => {
    if (ready && globe.current) globe.current.setPoints(withCoords.map((p) => ({ lat: p.lat as number, lng: p.lng as number })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data]);
  useEffect(() => {
    if (!globe.current) return;
    const p = active !== null ? partners[active] : null;
    globe.current.setActive(p ? withCoords.indexOf(p) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready]);

  return (
    <div ref={wrap} className={`card card--deep globe-card${compact ? ' globe-card--compact' : ''}`}>
      <div className="globe-card__text">
        <span className="eyebrow">{t.partnersEyebrow}</span>
        <h2 className="h2"><Em text={t.partnersTitle} /></h2>
        
        {error ? <ErrorNotice error={error} onRetry={reload} compact /> : (
          <ul className="ulist" onMouseLeave={() => setActive(null)}>
            {loading && [0, 1, 2, 3].map((i) => <li key={i}><Skel h={42} r={13} style={{ opacity: 0.15 }} /></li>)}
            {partners.map((p, i) => (
              <li key={p.id}>
                <a
                  href={p.website_url || '#hamkorlar'}
                  target={p.website_url ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  onClick={(e) => { if (!p.website_url) e.preventDefault(); }}
                  className={`ulist__item${active === i ? ' is-on' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <Flag code={p.country_code} />
                  <span className="ulist__name">{p.name}</span>
                  <small>{p.country}</small>
                  {p.qs_rank ? <span className="sr-only">, QS #{p.qs_rank}</span> : null}
                </a>
              </li>
            ))}
          </ul>
        )}
        <p className="globe-card__detail" aria-live="polite">
          {active !== null && partners[active] ? (
            <>{partners[active].qs_rank ? <b>QS #{partners[active].qs_rank}{partners[active].qs_year ? ` · ${partners[active].qs_year}` : ''}</b> : null}<span>{partners[active].description || partners[active].name}</span>{partners[active].website_url && <ArrowUpRight aria-hidden="true" />}</>
          ) : <span className="globe-card__hint">{typo(page?.blocks?.text, lang) || t.partnersLead}</span>}
        </p>
      </div>
      <div className="globe-card__stage" aria-hidden="true">
        <div className={`globe-fallback${ready ? ' is-hidden' : ''}`} />
        <canvas ref={canvas} className={`globe-canvas${ready ? ' is-ready' : ''}`} />
      </div>
    </div>
  );
}
