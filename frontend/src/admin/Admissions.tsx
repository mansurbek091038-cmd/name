import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { CalendarClock, Download, Kanban, MessageSquare, Phone, Search, Send, Table2, Trash2, UserRound, X } from 'lucide-react';
import { api, download } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { useDebounced } from '@/lib/hooks';
import { fmtDateTime, prettyPhone, telHref } from '@/lib/format';
import type { Admission, AdmissionDetail, AdmissionStatus, Paged } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { hasRole, useAuth } from './auth';
import { Drawer, Empty, Loading, PageHead, Pagination, STATUS, STATUS_KEYS, StatusBadge, useConfirm } from './ui';

interface Staff { id: number; full_name: string; role: string }
const SOURCES = ['direct', 'instagram', 'telegram', 'facebook', 'google', 'youtube'];
const gradeTxt = (g: unknown) => (g === null || g === undefined ? '—' : String(g) === '0' ? 'Tayyorlov' : `${g}-sinf`);
const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function Admissions() {
  const { user } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [view, setView] = useState<'table' | 'kanban'>(() => (localStorage.getItem('ss_crm_view') as 'table' | 'kanban') || 'table');
  const [q, setQ] = useState('');
  const dq = useDebounced(q.trim(), 350);
  const [f, setF] = useState({ status: '', source: '', assigned_to: '', date_from: '', date_to: '' });
  const [page, setPage] = useState(1);
  const filters = { search: dq, ...f, status: view === 'kanban' ? '' : f.status };
  const list = useQuery<Paged<Admission>>('/admin/admissions', { ...filters, page: view === 'kanban' ? 1 : page, page_size: view === 'kanban' ? 100 : 20 }, { keepPrevious: true });
  const { data: staff } = useQuery<Staff[]>('/admin/staff');
  const openId = sp.get('open');
  useEffect(() => { localStorage.setItem('ss_crm_view', view); }, [view]);
  useEffect(() => { setPage(1); }, [dq, f.status, f.source, f.assigned_to, f.date_from, f.date_to]);

  const open = (id: number | null) => { const n = new URLSearchParams(sp); if (id) n.set('open', String(id)); else n.delete('open'); setSp(n, { replace: true }); };
  const refresh = () => { invalidate('/admin/admissions'); invalidate('/admin/reports'); list.reload(); };

  const patch = async (id: number, body: Record<string, unknown>) => {
    await api.patch(`/admin/admissions/${id}`, body);
    refresh();
  };
  const exportXlsx = async () => {
    try { await download('/admin/admissions/export', { search: dq, ...f }, 'arizalar.xlsx'); toast('Excel fayl yuklab olindi'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  const hasFilter = !!(dq || f.status || f.source || f.assigned_to || f.date_from || f.date_to);

  return (
    <>
      <PageHead eyebrow="CRM" title={<>Qabul <em>arizalari</em></>} sub={list.data ? `${list.data.total} ta ariza` : ' '}
        actions={<>
          <div className="seg" role="group" aria-label="Ko‘rinish">
            <button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 className="a-seg-ico" />Jadval</button>
            <button type="button" aria-pressed={view === 'kanban'} onClick={() => setView('kanban')}><Kanban className="a-seg-ico" />Kanban</button>
          </div>
          {hasRole(user, 'admin') && <button type="button" className="btn btn--ghost btn--sm" onClick={exportXlsx}><Download />Excel</button>}
        </>} />

      <div className="a-filters">
        <label className="input-icon a-filters__search"><Search /><span className="sr-only">Qidirish</span>
          <input className="input input--sm" placeholder="Ism, telefon yoki raqam…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {view === 'table' && (
          <select className="select select--sm" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Holat">
            <option value="">Barcha holatlar</option>
            {STATUS_KEYS.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
          </select>
        )}
        <select className="select select--sm" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} aria-label="Manba">
          <option value="">Barcha manbalar</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s === 'direct' ? 'To‘g‘ridan-to‘g‘ri' : s}</option>)}
        </select>
        <select className="select select--sm" value={f.assigned_to} onChange={(e) => setF({ ...f, assigned_to: e.target.value })} aria-label="Mas’ul">
          <option value="">Barcha mas’ullar</option>
          <option value="me">Menga biriktirilgan</option>
          <option value="none">Biriktirilmagan</option>
          {(staff ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
        <label className="a-filters__date"><span>dan</span><input type="date" className="input input--sm" value={f.date_from} onChange={(e) => setF({ ...f, date_from: e.target.value })} /></label>
        <label className="a-filters__date"><span>gacha</span><input type="date" className="input input--sm" value={f.date_to} onChange={(e) => setF({ ...f, date_to: e.target.value })} /></label>
        {hasFilter && <button type="button" className="btn btn--text" onClick={() => { setQ(''); setF({ status: '', source: '', assigned_to: '', date_from: '', date_to: '' }); }}><X />Tozalash</button>}
      </div>

      {list.error ? <ErrorNotice error={list.error} onRetry={list.reload} /> : !list.data ? <Loading /> : view === 'table' ? (
        <div className="a-panel a-panel--flush">
          <div className="a-table-wrap">
            <table className="a-table">
              <thead><tr><th>Ariza</th><th>Farzand / ota-ona</th><th>Telefon</th><th>Sinf</th><th>Manba</th><th>Holat</th><th>Mas’ul</th><th>Qo‘ng‘iroq</th><th aria-label="Izohlar" /></tr></thead>
              <tbody>
                {list.data.items.map((a) => (
                  <tr key={a.id} onClick={() => open(a.id)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') open(a.id); }} className={String(a.id) === openId ? 'is-on' : ''}>
                    <td><b className="a-mono">{a.number}</b><small>{fmtDateTime(a.created_at)}</small></td>
                    <td><b>{a.child_name}</b><small>{a.parent_name}</small></td>
                    <td className="a-nowrap">{prettyPhone(a.phone)}</td>
                    <td className="a-nowrap">{gradeTxt(a.target_grade)}</td>
                    <td>{a.utm_source ? <span className="tag tag--soft">{a.utm_source}</span> : <span className="a-muted">—</span>}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select className={`a-status-sel`} style={{ '--c': STATUS[a.status]?.color } as React.CSSProperties} value={a.status} aria-label="Holatni o‘zgartirish"
                        onChange={async (e) => { try { await patch(a.id, { status: e.target.value }); toast('Holat yangilandi'); } catch (er) { toast((er as Error).message, 'error'); } }}>
                        {STATUS_KEYS.map((k) => <option key={k} value={k}>{STATUS[k].label}</option>)}
                      </select>
                    </td>
                    <td>{a.assigned_to?.full_name ?? <span className="a-muted">—</span>}</td>
                    <td className="a-nowrap">{a.next_call_at ? <span className={new Date(a.next_call_at) < new Date() ? 'a-overdue' : ''}>{fmtDateTime(a.next_call_at)}</span> : <span className="a-muted">—</span>}</td>
                    <td>{a.notes_count ? <span className="a-notes-count"><MessageSquare />{a.notes_count}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!list.data.items.length && <Empty>Arizalar topilmadi.</Empty>}
          </div>
          <Pagination page={page} pages={list.data.pages} total={list.data.total} onPage={setPage} />
        </div>
      ) : (
        <KanbanBoard items={list.data.items} onOpen={open} onMove={async (id, status) => {
          try { await patch(id, { status }); toast(`Holat: ${STATUS[status].label}`); } catch (er) { toast((er as Error).message, 'error'); }
        }} />
      )}

      <AdmissionDrawer id={openId ? Number(openId) : null} staff={staff ?? []} onClose={() => open(null)} onChanged={refresh} />
    </>
  );
}

function KanbanBoard({ items, onOpen, onMove }: { items: Admission[]; onOpen: (id: number) => void; onMove: (id: number, s: AdmissionStatus) => void }) {
  const [local, setLocal] = useState(items);
  const [over, setOver] = useState<AdmissionStatus | null>(null);
  useEffect(() => setLocal(items), [items]);
  const cols = useMemo(() => STATUS_KEYS.map((k) => ({ k, items: local.filter((a) => a.status === k) })), [local]);
  return (
    <div className="a-kanban">
      {cols.map((c) => (
        <section key={c.k} className={`a-kcol${over === c.k ? ' is-over' : ''}`} style={{ '--c': STATUS[c.k].color } as React.CSSProperties}
          onDragOver={(e) => { e.preventDefault(); setOver(c.k); }} onDragLeave={() => setOver(null)}
          onDrop={(e) => {
            e.preventDefault(); setOver(null);
            const id = Number(e.dataTransfer.getData('text/plain'));
            const a = local.find((x) => x.id === id);
            if (!a || a.status === c.k) return;
            setLocal((s) => s.map((x) => (x.id === id ? { ...x, status: c.k } : x)));
            onMove(id, c.k);
          }}>
          <header><i />{STATUS[c.k].label}<b>{c.items.length}</b></header>
          <div className="a-kcol__list">
            <AnimatePresence initial={false}>
              {c.items.map((a) => (
                <m.button layout key={a.id} type="button" className="a-kcard" draggable
                  onDragStart={(e) => (e as unknown as React.DragEvent).dataTransfer.setData('text/plain', String(a.id))}
                  onClick={() => onOpen(a.id)} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <span className="a-kcard__top"><span className="a-mono">{a.number}</span><small>{gradeTxt(a.target_grade)}</small></span>
                  <b>{a.child_name}</b>
                  <small>{a.parent_name}</small>
                  <span className="a-kcard__foot">
                    <span><Phone />{prettyPhone(a.phone)}</span>
                    {a.next_call_at && <span className={new Date(a.next_call_at) < new Date() ? 'a-overdue' : ''}><CalendarClock />{fmtDateTime(a.next_call_at).slice(0, 5)}</span>}
                    {a.assigned_to && <span title={a.assigned_to.full_name}><UserRound />{a.assigned_to.full_name.split(' ')[0]}</span>}
                  </span>
                </m.button>
              ))}
            </AnimatePresence>
            {!c.items.length && <p className="a-kcol__empty">Bo‘sh</p>}
          </div>
        </section>
      ))}
    </div>
  );
}

function AdmissionDrawer({ id, staff, onClose, onChanged }: { id: number | null; staff: Staff[]; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data: a, error, reload } = useQuery<AdmissionDetail>(id ? `/admin/admissions/${id}` : null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [call, setCall] = useState('');
  useEffect(() => setCall(toLocalInput(a?.next_call_at)), [a?.next_call_at, a?.id]);

  const save = async (body: Record<string, unknown>, msg: string) => {
    if (!a) return;
    setBusy(true);
    try { await api.patch(`/admin/admissions/${a.id}`, body); invalidate(`/admin/admissions/${a.id}`); reload(); onChanged(); toast(msg); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const addNote = async () => {
    if (!a || !note.trim()) return;
    setBusy(true);
    try { await api.post(`/admin/admissions/${a.id}/notes`, { text: note.trim() }); setNote(''); invalidate(`/admin/admissions/${a.id}`); reload(); onChanged(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!a || !(await confirm(`${a.number} arizasini o‘chirasizmi? Bu amalni qaytarib bo‘lmaydi.`, { danger: true, ok: 'O‘chirish' }))) return;
    try { await api.del(`/admin/admissions/${a.id}`); onChanged(); onClose(); toast('Ariza o‘chirildi'); } catch (e) { toast((e as Error).message, 'error'); }
  };

  const timeline = useMemo(() => {
    if (!a) return [];
    const notes = (a.notes ?? []).map((n) => ({ kind: 'note' as const, at: n.created_at, who: n.author?.full_name ?? '—', text: n.text }));
    const hist = (a.history ?? []).filter((h) => h.action !== 'note').map((h) => ({ kind: 'event' as const, at: String(h.created_at ?? ''), who: typeof h.user === 'object' && h.user ? h.user.full_name : 'Tizim', text: describe(h) }));
    return [...notes, ...hist].sort((x, y) => (x.at < y.at ? 1 : -1));
  }, [a]);

  return (
    <Drawer open={id !== null} onClose={onClose} width={620}
      title={a ? <>{a.child_name} <span className="a-mono a-muted" style={{ fontSize: 14 }}>{a.number}</span></> : 'Ariza'}
      sub={a ? <>Yuborilgan: {fmtDateTime(a.created_at)}</> : undefined}
      footer={a && hasRole(user, 'admin') ? <button type="button" className="btn btn--ghost btn--sm a-danger-text" onClick={del}><Trash2 />O‘chirish</button> : undefined}>
      {error ? <ErrorNotice error={error} onRetry={reload} /> : !a ? <Loading /> : (
        <>
          <div className="a-status-pick" role="radiogroup" aria-label="Holat">
            {STATUS_KEYS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={a.status === k} disabled={busy} style={{ '--c': STATUS[k].color } as React.CSSProperties}
                onClick={() => a.status !== k && save({ status: k }, `Holat: ${STATUS[k].label}`)}>{STATUS[k].label}</button>
            ))}
          </div>
          <dl className="a-dl">
            <div><dt>Ota-ona</dt><dd>{a.parent_name}</dd></div>
            <div><dt>Telefon</dt><dd><a href={telHref(a.phone)} className="a-link">{prettyPhone(a.phone)}</a></dd></div>
            <div><dt>Farzand</dt><dd>{a.child_name}{a.birth_year ? `, ${a.birth_year}-y.` : ''}</dd></div>
            <div><dt>Sinf</dt><dd>{gradeTxt(a.target_grade)}</dd></div>
            <div><dt>Manba</dt><dd>{a.utm_source ?? 'To‘g‘ridan-to‘g‘ri'}{a.utm_campaign ? ` · ${a.utm_campaign}` : ''}</dd></div>
            <div><dt>Holat</dt><dd><StatusBadge s={a.status} /></dd></div>
            {a.comment && <div className="a-dl__wide"><dt>Izoh</dt><dd>{a.comment}</dd></div>}
          </dl>
          <div className="a-drawer__grid">
            <div className="field">
              <label className="field__label" htmlFor="adm-assign">Mas’ul xodim</label>
              <select id="adm-assign" className="select select--sm" value={a.assigned_to?.id ?? ''} disabled={busy}
                onChange={(e) => save({ assigned_to: e.target.value ? Number(e.target.value) : null }, 'Mas’ul biriktirildi')}>
                <option value="">— Biriktirilmagan —</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="adm-call">Qayta qo‘ng‘iroq</label>
              <div className="a-inline">
                <input id="adm-call" type="datetime-local" className="input input--sm" value={call} onChange={(e) => setCall(e.target.value)} />
                <button type="button" className="btn btn--ink btn--sm" disabled={busy || call === toLocalInput(a.next_call_at)} onClick={() => save({ next_call_at: call ? call + ':00' : null }, 'Qo‘ng‘iroq vaqti saqlandi')}>Saqlash</button>
              </div>
            </div>
          </div>
          <h3 className="a-subh">Izohlar va tarix</h3>
          <div className="a-note-add">
            <textarea className="textarea" rows={3} placeholder="Qo‘ng‘iroq natijasi, kelishuvlar…" value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote(); }} />
            <button type="button" className="btn btn--gold btn--sm" disabled={busy || !note.trim()} onClick={addNote}><Send />Izoh qo‘shish</button>
          </div>
          <ol className="a-timeline">
            {timeline.map((x, i) => (
              <li key={i} className={`a-timeline__${x.kind}`}>
                <span className="a-timeline__dot" aria-hidden="true" />
                <div><b>{x.who}</b><small>{fmtDateTime(x.at)}</small></div>
                <p>{x.text}</p>
              </li>
            ))}
            {!timeline.length && <li className="a-muted">Hali izohlar yo‘q.</li>}
          </ol>
        </>
      )}
    </Drawer>
  );
}

function describe(h: Record<string, unknown>): string {
  const details = (h.details ?? {}) as { changes?: Record<string, { from: unknown; to: unknown }> };
  const ch = details.changes;
  if (ch) {
    return Object.entries(ch).map(([k, v]) => {
      const name = k === 'status' ? 'Holat' : k === 'assigned_to' ? 'Mas’ul' : k === 'next_call_at' ? 'Qo‘ng‘iroq' : k;
      const fmt = (x: unknown) => (k === 'status' ? STATUS[x as AdmissionStatus]?.label ?? String(x ?? '—') : k === 'next_call_at' && x ? fmtDateTime(String(x)) : String(x ?? '—'));
      return `${name}: ${fmt(v?.from)} → ${fmt(v?.to)}`;
    }).join(' · ');
  }
  const a = String(h.action ?? '');
  return a === 'create' ? 'Ariza yaratildi' : a === 'export' ? 'Eksport qilindi' : a;
}
