import { AlertTriangle, CheckCircle2, Info, RotateCw, SearchX } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useI18n } from '@/lib/i18n';
import { errorText } from '@/lib/format';

export function ErrorNotice({ error, onRetry, compact }: { error: unknown; onRetry?: () => void; compact?: boolean }) {
  const { t } = useI18n();
  const e = errorText(error, t);
  return (
    <div className="notice" role="alert" style={compact ? { padding: '12px 14px' } : undefined}>
      <AlertTriangle aria-hidden="true" />
      <div>
        <b>{e.title}</b>
        <p>{e.text}</p>
        {e.code && e.code !== 'UNKNOWN' && <code>{e.code}</code>}
        {onRetry && (
          <div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onRetry}><RotateCw aria-hidden="true" />{t.retry}</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Notice({ kind = 'info', title, children }: { kind?: 'info' | 'ok'; title?: string; children?: ReactNode }) {
  const Ico = kind === 'ok' ? CheckCircle2 : Info;
  return (
    <div className={`notice notice--${kind}`} role="status">
      <Ico aria-hidden="true" />
      <div>{title && <b>{title}</b>}{children && <p>{children}</p>}</div>
    </div>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <SearchX aria-hidden="true" />
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

/** Full-height placeholder while a page's CMS data loads (renders the page in one pass → no layout shift). */
export function PageLoading() {
  return <div className="page-loading" aria-busy="true"><span className="spinner" /></div>;
}

export function Skel({ h = 20, w = '100%', r, style }: { h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="skel" aria-hidden="true" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

/* ---------- toasts ---------- */
interface ToastItem { id: number; text: string; kind: 'ok' | 'error' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        <AnimatePresence>
          {items.map((x) => (
            <m.div key={x.id} className={`toast toast--${x.kind}`} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}>
              {x.kind === 'ok' ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
              <span>{x.text}</span>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
