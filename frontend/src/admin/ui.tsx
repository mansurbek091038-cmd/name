import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, m } from 'motion/react';
import { AlertTriangle, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useDialog, useLockBody } from '@/lib/hooks';
import { LANGS, type AdmissionStatus, type Lang } from '@/lib/types';

export const STATUS: Record<AdmissionStatus, { label: string; color: string }> = {
  new: { label: 'Yangi', color: '#C9962B' },
  contacted: { label: 'Bog‘lanildi', color: '#4A6FB5' },
  tour_scheduled: { label: 'Ekskursiya', color: '#7A5BB0' },
  interview: { label: 'Suhbat', color: '#2A8C82' },
  contract: { label: 'Shartnoma', color: '#178A4C' },
  rejected: { label: 'Rad etildi', color: '#A0525A' },
};
export const STATUS_KEYS = Object.keys(STATUS) as AdmissionStatus[];

export function StatusBadge({ s }: { s: string }) {
  const st = STATUS[s as AdmissionStatus] ?? { label: s, color: '#68718A' };
  return <span className="a-status" style={{ '--c': st.color } as React.CSSProperties}><i />{st.label}</span>;
}

export function PageHead({ title, sub, actions, eyebrow }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <header className="a-head">
      <div>
        {eyebrow && <span className="eyebrow eyebrow--plain">{eyebrow}</span>}
        <h1 className="a-head__title">{title}</h1>
        {sub && <p className="a-head__sub">{sub}</p>}
      </div>
      {actions && <div className="a-head__actions">{actions}</div>}
    </header>
  );
}

export function Panel({ title, actions, children, className = '', pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`a-panel ${className}`}>
      {(title || actions) && <div className="a-panel__head"><h2>{title}</h2>{actions}</div>}
      <div className={pad ? 'a-panel__body' : ''}>{children}</div>
    </section>
  );
}

export function Drawer({ open, onClose, title, sub, children, footer, width = 640 }: {
  open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLockBody(open);
  useDialog(open, onClose, ref);
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div className="a-drawer-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          <m.aside ref={ref} className="a-drawer" style={{ width: `min(${width}px, 100vw)` }} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 380, damping: 40 }}>
            <div className="a-drawer__head">
              <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
              <button type="button" className="icon-btn" onClick={onClose} aria-label="Yopish"><X /></button>
            </div>
            <div className="a-drawer__body">{children}</div>
            {footer && <div className="a-drawer__foot">{footer}</div>}
          </m.aside>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- confirm ---------- */
type ConfirmFn = (text: string, opts?: { danger?: boolean; ok?: string }) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<{ text: string; danger?: boolean; ok?: string; resolve: (v: boolean) => void } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = (v: boolean) => { st?.resolve(v); setSt(null); };
  useDialog(!!st, () => close(false), ref);
  const confirm = useCallback<ConfirmFn>((text, opts) => new Promise((resolve) => setSt({ text, ...opts, resolve })), []);
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {createPortal(
        <AnimatePresence>
          {st && (
            <m.div className="overlay" style={{ zIndex: 500 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <m.div ref={ref} className="dialog a-confirm" role="alertdialog" aria-modal="true" initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }}>
                <span className={`icon-tile ${st.danger ? 'a-danger-tile' : 'icon-tile--gold'}`}><AlertTriangle /></span>
                <p>{st.text}</p>
                <div className="a-confirm__btns">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => close(false)} data-autofocus>Bekor qilish</button>
                  <button type="button" className={`btn btn--sm ${st.danger ? 'btn--danger' : 'btn--ink'}`} onClick={() => close(true)}>{st.ok ?? 'Tasdiqlash'}</button>
                </div>
              </m.div>
            </m.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </ConfirmCtx.Provider>
  );
}

/* ---------- language tabs for content forms ---------- */
export function LangTabs({ value, onChange, filled, errors }: { value: Lang; onChange: (l: Lang) => void; filled?: Partial<Record<Lang, boolean>>; errors?: Partial<Record<Lang, boolean>> }) {
  return (
    <div className="a-langtabs" role="tablist" aria-label="Til">
      {LANGS.map((l) => (
        <button key={l} type="button" role="tab" aria-selected={value === l} className={value === l ? 'is-on' : ''} onClick={() => onChange(l)}>
          {l.toUpperCase()}
          {errors?.[l] ? <i className="a-dot a-dot--err" title="Xato" /> : filled ? <i className={`a-dot${filled[l] ? ' a-dot--ok' : ''}`} title={filled[l] ? 'To‘ldirilgan' : 'Bo‘sh'} /> : null}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total?: number; onPage: (p: number) => void }) {
  if (pages <= 1) return total !== undefined ? <div className="a-pager"><span>Jami: <b>{total}</b></span></div> : null;
  return (
    <div className="a-pager">
      {total !== undefined && <span>Jami: <b>{total}</b></span>}
      <div>
        <button type="button" className="icon-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Oldingi"><ChevronLeft /></button>
        <span className="a-pager__n">{page} / {pages}</span>
        <button type="button" className="icon-btn" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Keyingi"><ChevronRight /></button>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; id?: string }) {
  return (
    <label className="a-toggle" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="a-toggle__track" aria-hidden="true"><i /></span>
      <span>{label}</span>
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="a-empty">{children}</div>;
}

export function Loading() {
  return <div className="a-loading"><span className="spinner" /></div>;
}
