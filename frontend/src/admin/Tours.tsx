import { useEffect, useState } from 'react';
import { CalendarPlus, DoorOpen, Footprints, Pencil, Phone, Plus, Trash2, UserPlus, Users } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { fmtDateTime, isPhoneComplete, normalizePhone, prettyPhone, telHref } from '@/lib/format';
import type { Paged } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { PhoneInput } from '@/components/Forms';
import { Drawer, Empty, Loading, PageHead, Toggle, useConfirm } from './ui';

interface TourA { id: number; date: string; time: string; type: string; capacity: number; booked: number; free: number; note?: string; is_active: boolean; children_total?: number }
interface Booking { id: number; tour_id: number; parent_name: string; phone: string; children_count: number; comment?: string; created_at: string }
const UZ_M = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const UZ_D = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Juma', 'Shan'];

export default function Tours() {
  const toast = useToast();
  const confirm = useConfirm();
  const [upcoming, setUpcoming] = useState<'true' | 'false'>('true');
  const list = useQuery<Paged<TourA>>('/admin/tours', { upcoming, page_size: 100 });
  const [edit, setEdit] = useState<Partial<TourA> | null>(null);
  const [open, setOpen] = useState<TourA | null>(null);
  const refresh = () => { invalidate('/admin/tours'); invalidate('/public/tours'); list.reload(); };
  const items = [...(list.data?.items ?? [])].sort((a, b) => (upcoming === 'true' ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time)));

  const del = async (t: TourA) => {
    if (!(await confirm(`${t.date} ${t.time} ekskursiyasi o‘chirilsinmi? Yozilganlar ham o‘chadi (${t.booked} ta).`, { danger: true, ok: 'O‘chirish' }))) return;
    try { await api.del(`/admin/tours/${t.id}`); toast('O‘chirildi'); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <>
      <PageHead eyebrow="Tadbirlar" title={<>Ekskursiyalar va <em>ochiq eshiklar</em></>} sub="Sanalar, joylar soni va yozilgan ota-onalar."
        actions={<>
          <div className="seg" role="group" aria-label="Davr">
            <button type="button" aria-pressed={upcoming === 'true'} onClick={() => setUpcoming('true')}>Kelgusi</button>
            <button type="button" aria-pressed={upcoming === 'false'} onClick={() => setUpcoming('false')}>O‘tgan</button>
          </div>
          <button type="button" className="btn btn--gold btn--sm" onClick={() => setEdit({ type: 'ekskursiya', capacity: 15, time: '10:00', is_active: true, date: new Date(Date.now() + 86400e3 * 3).toISOString().slice(0, 10) })}><CalendarPlus />Yangi sana</button>
        </>} />
      {list.error ? <ErrorNotice error={list.error} onRetry={list.reload} /> : !list.data ? <Loading /> : !items.length ? <Empty>Sanalar yo‘q.</Empty> : (
        <div className="a-tours">
          {items.map((t) => {
            const d = new Date(t.date + 'T00:00:00');
            const pct = t.capacity ? Math.min(100, (t.booked / t.capacity) * 100) : 0;
            return (
              <article key={t.id} className={`a-tour${t.is_active ? '' : ' is-off'}`}>
                <button type="button" className="a-tour__main" onClick={() => setOpen(t)}>
                  <span className="a-tour__date"><b className="serif">{d.getDate()}</b><small>{UZ_M[d.getMonth()]} · {UZ_D[d.getDay()]}</small></span>
                  <span className="a-tour__info">
                    <span className={`tag ${t.type === 'ochiq_eshiklar' ? 'tag--gold' : 'tag--soft'}`}>{t.type === 'ochiq_eshiklar' ? <DoorOpen /> : <Footprints />}{t.type === 'ochiq_eshiklar' ? 'Ochiq eshiklar' : 'Ekskursiya'}</span>
                    <b>{t.time?.slice(0, 5)}</b>
                    {t.note && <small>{t.note}</small>}
                    {!t.is_active && <small className="a-danger-text">Yopiq (saytda ko‘rinmaydi)</small>}
                  </span>
                  <span className="a-tour__cap">
                    <span><Users />{t.booked}/{t.capacity}{t.children_total ? <small> · {t.children_total} bola</small> : null}</span>
                    <span className="a-bar"><i style={{ width: pct + '%', background: pct >= 100 ? '#A0525A' : undefined }} /></span>
                  </span>
                </button>
                <div className="a-row-actions">
                  <button type="button" className="icon-btn" aria-label="Tahrirlash" onClick={() => setEdit(t)}><Pencil /></button>
                  <button type="button" className="icon-btn a-danger-text" aria-label="O‘chirish" onClick={() => del(t)}><Trash2 /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <TourForm tour={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />
      <Bookings tour={open} onClose={() => setOpen(null)} onChanged={refresh} />
    </>
  );
}

function TourForm({ tour, onClose, onSaved }: { tour: Partial<TourA> | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<TourA>>({});
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (tour) { setF(tour); setErr(null); } }, [tour]);
  const save = async () => {
    setBusy(true); setErr(null);
    const body = { date: f.date, time: (f.time ?? '').slice(0, 5), capacity: Number(f.capacity), type: f.type, note: f.note ?? '', is_active: f.is_active ?? true };
    try { if (f.id) await api.put(`/admin/tours/${f.id}`, body); else await api.post('/admin/tours', body); toast('Saqlandi'); onSaved(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Drawer open={!!tour} onClose={onClose} width={520} title={f.id ? 'Sanani tahrirlash' : 'Yangi ekskursiya sanasi'}
      footer={<><button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Yopish</button><button type="button" className="btn btn--ink btn--sm" disabled={busy} onClick={save}>{busy && <span className="spinner" />}Saqlash</button></>}>
      <form className="a-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="field"><span className="field__label">Turi</span>
          <div className="seg" role="group">
            <button type="button" aria-pressed={f.type === 'ekskursiya'} onClick={() => setF({ ...f, type: 'ekskursiya' })}>Ekskursiya</button>
            <button type="button" aria-pressed={f.type === 'ochiq_eshiklar'} onClick={() => setF({ ...f, type: 'ochiq_eshiklar' })}>Ochiq eshiklar kuni</button>
          </div>
        </div>
        <div className="field a-half"><label className="field__label" htmlFor="t-date">Sana</label><input id="t-date" type="date" className="input input--sm" value={f.date ?? ''} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
        <div className="field a-half"><label className="field__label" htmlFor="t-time">Vaqt</label><input id="t-time" type="time" className="input input--sm" value={(f.time ?? '').slice(0, 5)} onChange={(e) => setF({ ...f, time: e.target.value })} /></div>
        <div className="field a-half"><label className="field__label" htmlFor="t-cap">Joylar soni</label><input id="t-cap" type="number" min={1} className="input input--sm" value={f.capacity ?? ''} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></div>
        <div className="field a-half" style={{ justifyContent: 'flex-end' }}><Toggle checked={f.is_active ?? true} onChange={(v) => setF({ ...f, is_active: v })} label="Saytda ochiq" /></div>
        <div className="field"><label className="field__label" htmlFor="t-note">Izoh</label><input id="t-note" className="input input--sm" value={f.note ?? ''} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Masalan, 1–4-sinflar uchun" /></div>
      </form>
      {err != null && <ErrorNotice error={err} compact />}
    </Drawer>
  );
}

function Bookings({ tour, onClose, onChanged }: { tour: TourA | null; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, reload } = useQuery<Paged<Booking>>(tour ? `/admin/tours/${tour.id}/bookings` : null, { page_size: 100 });
  const [add, setAdd] = useState({ parent_name: '', phone: '', children_count: '1' });
  const [err, setErr] = useState<unknown>(null);
  const refresh = () => { invalidate(`/admin/tours/${tour?.id}/bookings`); reload(); onChanged(); };
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tour) return;
    if (!add.parent_name.trim() || !isPhoneComplete(add.phone)) { setErr(new ApiError(422, 'VALIDATION_ERROR', 'Ism va to‘liq telefon raqamini kiriting')); return; }
    setErr(null);
    try { await api.post(`/admin/tours/${tour.id}/bookings`, { parent_name: add.parent_name.trim(), phone: normalizePhone(add.phone), children_count: Number(add.children_count) }); setAdd({ parent_name: '', phone: '', children_count: '1' }); toast('Yozib qo‘yildi'); refresh(); }
    catch (x) { setErr(x); }
  };
  const del = async (b: Booking) => {
    if (!tour || !(await confirm(`${b.parent_name} yozilishini bekor qilasizmi?`, { danger: true, ok: 'Bekor qilish' }))) return;
    try { await api.del(`/admin/tours/${tour.id}/bookings/${b.id}`); refresh(); } catch (x) { toast((x as Error).message, 'error'); }
  };
  return (
    <Drawer open={!!tour} onClose={onClose} width={620} title={tour ? `${tour.date} · ${tour.time?.slice(0, 5)}` : ''} sub={tour ? `${tour.type === 'ochiq_eshiklar' ? 'Ochiq eshiklar kuni' : 'Ekskursiya'} · ${tour.booked}/${tour.capacity} joy band` : undefined}>
      <form className="a-addrow" onSubmit={create}>
        <input className="input input--sm" placeholder="Ota-ona ismi" value={add.parent_name} onChange={(e) => setAdd({ ...add, parent_name: e.target.value })} aria-label="Ota-ona ismi" />
        <PhoneInput id="bk-phone" className="input input--sm" value={add.phone} onChange={(v) => setAdd({ ...add, phone: v })} />
        <select className="select select--sm" value={add.children_count} onChange={(e) => setAdd({ ...add, children_count: e.target.value })} aria-label="Bolalar soni">{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select>
        <button type="submit" className="btn btn--ink btn--sm"><UserPlus />Qo‘shish</button>
      </form>
      {err != null && <ErrorNotice error={err} compact />}
      {error ? <ErrorNotice error={error} onRetry={reload} /> : !data ? <Loading /> : !data.items.length ? <Empty><Plus /> Hali hech kim yozilmagan.</Empty> : (
        <ul className="a-bookings">
          {data.items.map((b, i) => (
            <li key={b.id}>
              <span className="a-bookings__n">{i + 1}</span>
              <span className="a-bookings__txt"><b>{b.parent_name}</b><small><a href={telHref(b.phone)}><Phone />{prettyPhone(b.phone)}</a> · {b.children_count} bola · {fmtDateTime(b.created_at)}</small>{b.comment && <small>{b.comment}</small>}</span>
              <button type="button" className="icon-btn a-danger-text" aria-label="Bekor qilish" onClick={() => del(b)}><Trash2 /></button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}
