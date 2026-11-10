import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle, ArrowRight, Send } from 'lucide-react';
import { Link } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { formatPhone, isPhoneComplete, normalizePhone } from '@/lib/format';
import { getUtm } from '@/lib/hooks';
import { useQuery } from '@/lib/query';
import type { SiteSettings } from '@/lib/types';
import { ErrorNotice, useToast } from './Feedback';

/* ---------- field shell ---------- */
export function Field({ label, error, hint, optional, children, className, id }: {
  label: string; error?: string; hint?: string; optional?: boolean; children: (id: string, describedBy?: string) => ReactNode; className?: string; id?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const errId = error ? fid + '-err' : undefined;
  const { t } = useI18n();
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="field__label" htmlFor={fid}>
        <span>{label}{!optional && <span aria-hidden="true" style={{ color: 'var(--gold-ink)' }}> *</span>}</span>
        {optional && <small>{t.optional}</small>}
      </label>
      {children(fid, errId)}
      {error ? <span className="field__error" id={errId}><AlertCircle size={14} aria-hidden="true" />{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </div>
  );
}

/* ---------- +998 XX XXX XX XX masked input ---------- */
export function PhoneInput({ id, value, onChange, invalid, describedBy, className = 'input' }: {
  id: string; value: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string; className?: string;
}) {
  return (
    <input
      id={id}
      className={className}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+998 90 123 45 67"
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      onFocus={() => { if (!value) onChange('+998 '); }}
      onBlur={() => { if (value.trim() === '+998') onChange(''); }}
      onChange={(e) => {
        const raw = e.target.value;
        // allow deleting back to the prefix
        if (raw.replace(/\D/g, '').length <= 3) { onChange(raw.startsWith('+998') ? '+998 ' : formatPhone(raw)); return; }
        onChange(formatPhone(raw));
      }}
    />
  );
}

/* ---------- Cloudflare Turnstile (only if a site key is configured) ---------- */
declare global {
  interface Window { turnstile?: { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void } }
}
export function Turnstile({ onToken }: { onToken: (t: string) => void }) {
  const { data } = useQuery<SiteSettings>('/public/settings');
  const key = data?.turnstile_site_key;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!key || !ref.current) return;
    const el = ref.current;
    const render = () => window.turnstile?.render(el, { sitekey: key, callback: onToken, theme: 'light' });
    if (window.turnstile) { render(); return; }
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [key, onToken]);
  if (!key) return null;
  return <div ref={ref} className="turnstile" />;
}

function fieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiError && e.fields) return e.fields;
  return {};
}

/* ---------- Admission form ---------- */
export function AdmissionForm({ compact = false, idPrefix = 'adm', submitLabel }: { compact?: boolean; idPrefix?: string; submitLabel?: string }) {
  const { t, to } = useI18n();
  const nav = useNavigate();
  const [v, setV] = useState({ parent_name: '', phone: '', child_name: '', birth_year: '', target_grade: '', comment: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [token, setToken] = useState<string>();
  const year = new Date().getFullYear();
  const set = (k: keyof typeof v) => (val: string) => { setV((s) => ({ ...s, [k]: val })); setErrs((e) => ({ ...e, [k]: '' })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!v.parent_name.trim()) er.parent_name = t.required;
    if (!isPhoneComplete(v.phone)) er.phone = t.invalidPhone;
    if (!v.child_name.trim()) er.child_name = t.required;
    if (v.target_grade === '') er.target_grade = t.required;
    setErrs(er);
    if (Object.keys(er).length) {
      const first = Object.keys(er)[0];
      document.getElementById(`${idPrefix}-${first}`)?.focus();
      return;
    }
    setBusy(true); setError(null);
    try {
      const res = await api.post<{ id: number; number: string; message?: string }>('/public/admissions', {
        parent_name: v.parent_name.trim(),
        phone: normalizePhone(v.phone),
        child_name: v.child_name.trim(),
        birth_year: v.birth_year ? Number(v.birth_year) : undefined,
        target_grade: v.target_grade,
        comment: v.comment.trim() || undefined,
        ...getUtm(),
        turnstile_token: token,
      });
      nav(to('/rahmat') + `?n=${encodeURIComponent(res.number ?? '')}`, { state: { number: res.number, message: res.message } });
    } catch (err) {
      setError(err);
      setErrs((s) => ({ ...s, ...fieldErrors(err) }));
    } finally {
      setBusy(false);
    }
  };

  const grades = Array.from({ length: 12 }, (_, i) => i);
  return (
    <form className={`form ${compact ? 'form--compact' : ''}`} onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field id={`${idPrefix}-parent_name`} label={t.parentName} error={errs.parent_name}>
          {(id, d) => <input id={id} className="input" autoComplete="name" placeholder={t.parentNamePh} value={v.parent_name} onChange={(e) => set('parent_name')(e.target.value)} aria-invalid={!!errs.parent_name || undefined} aria-describedby={d} />}
        </Field>
        <Field id={`${idPrefix}-phone`} label={t.phoneLabel} error={errs.phone}>
          {(id, d) => <PhoneInput id={id} value={v.phone} onChange={set('phone')} invalid={!!errs.phone} describedBy={d} />}
        </Field>
        <Field id={`${idPrefix}-child_name`} label={t.childName} error={errs.child_name}>
          {(id, d) => <input id={id} className="input" placeholder={t.childNamePh} value={v.child_name} onChange={(e) => set('child_name')(e.target.value)} aria-invalid={!!errs.child_name || undefined} aria-describedby={d} />}
        </Field>
        <Field id={`${idPrefix}-target_grade`} label={t.targetGrade} error={errs.target_grade}>
          {(id, d) => (
            <select id={id} className="select" value={v.target_grade} onChange={(e) => set('target_grade')(e.target.value)} aria-invalid={!!errs.target_grade || undefined} aria-describedby={d}>
              <option value="">{t.chooseGrade}</option>
              {grades.map((g) => <option key={g} value={String(g)}>{g === 0 ? t.gradePrep : `${g}${t.gradeShort}`}</option>)}
            </select>
          )}
        </Field>
        {!compact && (
          <Field id={`${idPrefix}-birth_year`} label={t.birthYear} optional error={errs.birth_year}>
            {(id) => (
              <select id={id} className="select" value={v.birth_year} onChange={(e) => set('birth_year')(e.target.value)}>
                <option value="">—</option>
                {Array.from({ length: 14 }, (_, i) => year - 4 - i).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </Field>
        )}
        <Field id={`${idPrefix}-comment`} label={t.comment} optional className={compact ? 'span-2' : ''} error={errs.comment}>
          {(id) => compact
            ? <input id={id} className="input" placeholder={t.commentPh} value={v.comment} onChange={(e) => set('comment')(e.target.value)} />
            : <input id={id} className="input" placeholder={t.commentPh} value={v.comment} onChange={(e) => set('comment')(e.target.value)} />}
        </Field>
      </div>
      <Turnstile onToken={setToken} />
      {error != null && <div style={{ marginTop: 16 }}><ErrorNotice error={error} compact /></div>}
      <div className="form__foot">
        <button type="submit" className="btn btn--gold btn--lg" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <Send aria-hidden="true" />}
          {busy ? t.sending : submitLabel || t.send}
        </button>
        <p className="form__consent">{t.consent} <Link to={to('/maxfiylik')}>{t.privacyLink}</Link></p>
      </div>
    </form>
  );
}

/* ---------- Contact form ---------- */
export function ContactForm() {
  const { t, to } = useI18n();
  const toast = useToast();
  const [v, setV] = useState({ name: '', phone: '', message: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof v) => (val: string) => { setV((s) => ({ ...s, [k]: val })); setErrs((e) => ({ ...e, [k]: '' })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!v.name.trim()) er.name = t.required;
    if (!isPhoneComplete(v.phone)) er.phone = t.invalidPhone;
    if (!v.message.trim()) er.message = t.required;
    setErrs(er);
    if (Object.keys(er).length) { document.getElementById(`ct-${Object.keys(er)[0]}`)?.focus(); return; }
    setBusy(true); setError(null);
    try {
      await api.post('/public/contact', { name: v.name.trim(), phone: normalizePhone(v.phone), message: v.message.trim() });
      setDone(true);
      toast(t.msgSent);
      setV({ name: '', phone: '', message: '' });
    } catch (err) {
      setError(err);
      setErrs((s) => ({ ...s, ...fieldErrors(err) }));
    } finally { setBusy(false); }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <Field id="ct-name" label={t.yourName} error={errs.name}>
          {(id, d) => <input id={id} className="input" autoComplete="name" value={v.name} onChange={(e) => set('name')(e.target.value)} aria-invalid={!!errs.name || undefined} aria-describedby={d} />}
        </Field>
        <Field id="ct-phone" label={t.phoneLabel} error={errs.phone}>
          {(id, d) => <PhoneInput id={id} value={v.phone} onChange={set('phone')} invalid={!!errs.phone} describedBy={d} />}
        </Field>
        <Field id="ct-message" label={t.message} error={errs.message} className="span-2">
          {(id, d) => <textarea id={id} className="textarea" rows={5} placeholder={t.messagePh} value={v.message} onChange={(e) => set('message')(e.target.value)} aria-invalid={!!errs.message || undefined} aria-describedby={d} />}
        </Field>
      </div>
      {error != null && <div style={{ marginTop: 16 }}><ErrorNotice error={error} compact /></div>}
      {done && !error && <p className="form__ok" role="status">{t.msgSent}</p>}
      <div className="form__foot">
        <button type="submit" className="btn btn--ink btn--lg" disabled={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
          {busy ? t.sending : t.sendMsg}
        </button>
        <p className="form__consent">{t.consent} <Link to={to('/maxfiylik')}>{t.privacyLink}</Link></p>
      </div>
    </form>
  );
}
