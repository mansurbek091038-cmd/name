import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { CalendarCheck, Check, DoorOpen, Footprints } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useQuery, invalidate } from '@/lib/query';
import { dateParts, isPhoneComplete, normalizePhone } from '@/lib/format';
import type { Tour } from '@/lib/types';
import { ErrorNotice, Notice, Skel } from './Feedback';
import { Field, PhoneInput } from './Forms';

export function TourBooking() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useQuery<Tour[] | { items: Tour[] }>('/public/tours', { lang });
  const tours = Array.isArray(data) ? data : data?.items ?? [];
  const [sel, setSel] = useState<number | null>(null);
  const [v, setV] = useState({ parent_name: '', phone: '', children_count: '1' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const selected = tours.find((x) => x.id === sel) ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const er: Record<string, string> = {};
    if (!v.parent_name.trim()) er.parent_name = t.required;
    if (!isPhoneComplete(v.phone)) er.phone = t.invalidPhone;
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setErr(null);
    try {
      const res = await api.post<{ message?: string }>(`/public/tours/${selected.id}/book`, {
        parent_name: v.parent_name.trim(), phone: normalizePhone(v.phone), children_count: Number(v.children_count) || 1,
      });
      setDone(res?.message || t.tourBooked);
      invalidate('/public/tours');
      reload();
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (loading) return <div className="tours-strip">{[0, 1, 2, 3].map((i) => <Skel key={i} h={168} r={22} />)}</div>;
  if (!tours.length) return <Notice>{t.noTours}</Notice>;

  return (
    <div className="tour-booking">
      <div className="tours-strip" role="radiogroup" aria-label={t.chooseTour}>
        {tours.map((x) => {
          const p = dateParts(x.date, lang);
          const isFull = x.free <= 0;
          const pct = x.capacity ? Math.min(100, Math.round((x.booked / x.capacity) * 100)) : 0;
          const open = x.type === 'ochiq_eshiklar';
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={sel === x.id}
              disabled={isFull}
              className={`tour-tile${sel === x.id ? ' is-on' : ''}${open ? ' tour-tile--open' : ''}`}
              onClick={() => { setSel(x.id); setDone(null); setErr(null); }}
            >
              <span className="tour-tile__type">{open ? <DoorOpen aria-hidden="true" /> : <Footprints aria-hidden="true" />}{open ? t.tourOpenDay : t.tourEkskursiya}</span>
              <span className="tour-tile__day serif">{p.day}</span>
              <span className="tour-tile__month">{p.month}</span>
              <span className="tour-tile__meta">{p.weekday}{x.time ? ` · ${x.time.slice(0, 5)}` : ''}</span>
              <span className="tour-tile__bar" aria-hidden="true"><i style={{ width: pct + '%' }} /></span>
              <span className="tour-tile__free">{isFull ? t.full : `${x.free} ${t.freePlaces}`}</span>
              {sel === x.id && <span className="tour-tile__check" aria-hidden="true"><Check /></span>}
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false}>
        {selected && (
          <m.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
            {done ? (
              <div className="tour-done" role="status">
                <span className="icon-tile icon-tile--gold"><CalendarCheck aria-hidden="true" /></span>
                <div><b className="serif">{t.tourBooked}</b><p>{done}</p></div>
              </div>
            ) : (
              <form className="tour-form" onSubmit={submit} noValidate>
                <Field id="tb-parent" label={t.parentName} error={errs.parent_name}>
                  {(id, d) => <input id={id} className="input" autoComplete="name" value={v.parent_name} onChange={(e) => setV({ ...v, parent_name: e.target.value })} aria-invalid={!!errs.parent_name || undefined} aria-describedby={d} />}
                </Field>
                <Field id="tb-phone" label={t.phoneLabel} error={errs.phone}>
                  {(id, d) => <PhoneInput id={id} value={v.phone} onChange={(p) => setV({ ...v, phone: p })} invalid={!!errs.phone} describedBy={d} />}
                </Field>
                <Field id="tb-count" label={t.childrenCount}>
                  {(id) => (
                    <select id={id} className="select" value={v.children_count} onChange={(e) => setV({ ...v, children_count: e.target.value })}>
                      {Array.from({ length: Math.max(1, Math.min(5, selected.free)) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                </Field>
                <button type="submit" className="btn btn--ink btn--lg tour-form__btn" disabled={busy}>
                  {busy ? <span className="spinner" aria-hidden="true" /> : <CalendarCheck aria-hidden="true" />}{busy ? t.sending : t.bookTour}
                </button>
                {err != null && <div className="tour-form__err"><ErrorNotice error={err} compact /></div>}
              </form>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
