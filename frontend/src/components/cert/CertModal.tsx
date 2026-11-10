import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { BadgeCheck, ChevronLeft, ChevronRight, Download, ExternalLink, Link2, Maximize2, Printer, ShieldCheck, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useDialog, useLockBody } from '@/lib/hooks';
import { fmtDate, gradeLabel, img } from '@/lib/format';
import type { Certificate } from '@/lib/types';
import { useToast } from '../Feedback';
import { isOlymp, scoreText, subRows, typeLabel } from './certUtils';
import { exportCertPng } from './exportPng';
import '@/styles/cert.css';

export function CertModal({ items, index, onClose, onIndex }: {
  items: Certificate[]; index: number | null; onClose: () => void; onIndex: (i: number) => void;
}) {
  const open = index !== null && !!items[index];
  useLockBody(open);
  return createPortal(
    <AnimatePresence>
      {open && <Inner key="cm" items={items} index={index!} onClose={onClose} onIndex={onIndex} />}
    </AnimatePresence>,
    document.body,
  );
}

function Inner({ items, index, onClose, onIndex }: { items: Certificate[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);
  const c = items[index];
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const [dir, setDir] = useState(0);
  useDialog(true, onClose, ref);

  const go = (d: number) => {
    const n = index + d;
    if (n < 0 || n >= items.length) return;
    setDir(d); setZoom(null); onIndex(n);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const subs = subRows(c, t);
  const large = img(c.image, 'large') ?? img(c.image, 'url');
  const medium = img(c.image, 'medium');
  const share = async () => {
    const url = new URL(location.href);
    url.searchParams.set('cert', String(c.id));
    try { await navigator.clipboard.writeText(url.toString()); toast(t.linkCopied); } catch { toast(url.toString()); }
  };

  const rows: [string, string][] = [
    [t.examDate, c.date ? fmtDate(c.date, lang) : c.year ? String(c.year) : ''],
    [t.gradeLabel, gradeLabel(c.grade, t, lang)],
    [t.subject, isOlymp(c.type) || c.type === 'boshqa' ? c.subject ?? '' : ''],
    [t.level, c.level ?? ''],
    [t.mentor, c.teacher ?? ''],
    [t.certNo, c.cert_number_masked ?? ''],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <m.div className="overlay cert-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <m.div
        ref={ref}
        className="dialog cert-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cert-title"
        initial={{ opacity: 0, y: 30, scale: 0.97, rotateX: 6 }}
        animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <button type="button" className="dialog__close" onClick={onClose} aria-label={t.close} data-autofocus><X /></button>

        <div className="cert-dialog__media">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <m.button
              key={c.id}
              type="button"
              className={`cert-zoom${zoom ? ' is-zoomed' : ''}`}
              aria-label={t.zoomIn}
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -dir * 60 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => {
                if (zoom) { setZoom(null); return; }
                const r = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}
              onMouseMove={(e) => {
                if (!zoom) return;
                const r = e.currentTarget.getBoundingClientRect();
                setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
              }}
            >
              {medium && (
                <img
                  src={zoom ? large ?? medium : medium}
                  alt={`${typeLabel(c.type, t)} — ${c.student_name}`}
                  style={zoom ? { transformOrigin: `${zoom.x}% ${zoom.y}%`, transform: 'scale(2.1)' } : undefined}
                />
              )}
            </m.button>
          </AnimatePresence>
          <div className="cert-dialog__nav">
            <button type="button" className="icon-btn" onClick={() => go(-1)} disabled={index === 0} aria-label={t.prev}><ChevronLeft /></button>
            <span>{index + 1} / {items.length}</span>
            <button type="button" className="icon-btn" onClick={() => go(1)} disabled={index === items.length - 1} aria-label={t.next}><ChevronRight /></button>
          </div>
        </div>

        <div className="cert-dialog__info">
          <div className="cert-dialog__tags">
            <span className="tag">{typeLabel(c.type, t)}</span>
            <span className="tag tag--green"><BadgeCheck aria-hidden="true" />{t.verified}</span>
            {c.is_featured && <span className="tag tag--gold">★ {t.featured}</span>}
          </div>
          <p className="cert-dialog__certifies">{t.certifies}</p>
          <h2 id="cert-title" className="h3">{c.student_name}</h2>

          <div className="cert-dialog__score">
            <span className="cert-dialog__big serif">{scoreText(c, t)}</span>
            <span className="cert-dialog__scorelbl">{t.score}<br /><b>{isOlymp(c.type) ? c.subject ?? t.typeOlympiad : typeLabel(c.type, t)}</b></span>
          </div>

          {subs.length > 0 && (
            <ul className="subscores" aria-label={t.score}>
              {subs.map((s, i) => (
                <li key={s.key}>
                  <span>{s.label}</span>
                  <span className="subscores__bar"><m.i initial={{ width: 0 }} animate={{ width: s.pct + '%' }} transition={{ delay: 0.15 + i * 0.07, duration: 0.8, ease: [0.22, 0.8, 0.24, 1] }} /></span>
                  <b>{s.value}</b>
                </li>
              ))}
            </ul>
          )}

          <dl className="cert-dialog__dl">
            {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>

          <div className="cert-dialog__actions">
            {c.verify_url && (
              <a className="btn btn--ink btn--sm" href={c.verify_url} target="_blank" rel="noopener noreferrer"><ShieldCheck aria-hidden="true" />{t.verifyOnline}</a>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.print()}><Printer aria-hidden="true" />{t.print}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => exportCertPng(c, t, lang)}><Download aria-hidden="true" />{t.exportPng}</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={share}><Link2 aria-hidden="true" />{t.copyLink}</button>
            {large && <a className="btn btn--ghost btn--sm" href={img(c.image, 'url') ?? large} target="_blank" rel="noopener"><Maximize2 aria-hidden="true" />{t.openFull}<ExternalLink aria-hidden="true" style={{ width: 14 }} /></a>}
          </div>
          <p className="cert-dialog__tip">{t.kbdTip}</p>
        </div>

        {/* print-only sheet */}
        <div className="cert-print" aria-hidden="true">
          <div className="cert-print__head">
            <img src="/brand/logo-192.webp" alt="" width={64} height={64} />
            <div><b>Smart Start</b><span>{t.schoolSub} · {t.city}</span></div>
          </div>
          <p className="cert-print__k">{t.certifies}</p>
          <h1>{c.student_name}</h1>
          <p className="cert-print__score">{typeLabel(c.type, t)} — <b>{scoreText(c, t)}</b></p>
          {subs.length > 0 && <p className="cert-print__subs">{subs.map((s) => `${s.label}: ${s.value}`).join('   ·   ')}</p>}
          <p className="cert-print__meta">{rows.map(([k, v]) => `${k}: ${v}`).join('   ·   ')}</p>
          {medium && <img className="cert-print__img" src={large ?? medium} alt="" />}
          {c.verify_url && <p className="cert-print__meta">{c.verify_url}</p>}
        </div>
      </m.div>
    </m.div>
  );
}
