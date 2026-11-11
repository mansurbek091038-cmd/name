import { useState } from 'react';
import { useQuery } from '@/lib/query';
import { fmtDateTime } from '@/lib/format';
import type { Paged } from '@/lib/types';
import { ErrorNotice } from '@/components/Feedback';
import { Loading, PageHead, Pagination } from './ui';

interface Row { id: number; user: { id: number; full_name: string } | null; action: string; entity: string; entity_id: number | null; details: unknown; ip?: string; created_at: string }
const ACTION: Record<string, string> = { create: 'Yaratdi', update: 'O‘zgartirdi', delete: 'O‘chirdi', login: 'Tizimga kirdi', login_failed: 'Kirish xatosi', note: 'Izoh qo‘shdi', export: 'Eksport', upload: 'Fayl yukladi', reorder: 'Tartibladi', change_password: 'Parolni o‘zgartirdi' };
const ENTITY: Record<string, string> = { admission: 'Ariza', post: 'Yangilik', teacher: 'O‘qituvchi', certificate: 'Sertifikat', partner: 'Hamkor', price: 'Narx', faq: 'FAQ', testimonial: 'Fikr', album: 'Albom', media: 'Fayl', page: 'Sahifa', tour: 'Ekskursiya', booking: 'Yozilish', user: 'Foydalanuvchi', settings: 'Sozlamalar', contact_message: 'Xabar', course: 'Kurs', course_enrollment: 'Kursga ariza' };

function summary(d: unknown): string {
  if (!d || typeof d !== 'object') return '';
  const o = d as Record<string, unknown>;
  if (o.changes && typeof o.changes === 'object') {
    return Object.entries(o.changes as Record<string, { from?: unknown; to?: unknown } | unknown>).slice(0, 4).map(([k, v]) => {
      if (v && typeof v === 'object' && 'to' in (v as object)) {
        const c = v as { from?: unknown; to?: unknown };
        const s = (x: unknown) => { const t = typeof x === 'object' ? JSON.stringify(x) : String(x ?? '—'); return t.length > 30 ? t.slice(0, 30) + '…' : t; };
        return `${k}: ${s(c.from)} → ${s(c.to)}`;
      }
      return k;
    }).join(' · ');
  }
  if (o.key) return `kalit: ${String(o.key)}`;
  if (o.name) return String(o.name);
  if (o.count !== undefined) return `${String(o.count)} ta yozuv`;
  return '';
}

export default function Audit() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const { data, error, reload } = useQuery<Paged<Row>>('/admin/audit-log', { page, page_size: 50, entity, action }, { keepPrevious: true });
  return (
    <>
      <PageHead eyebrow="Tizim" title={<>Audit <em>jurnali</em></>} sub="Kim, qachon va nimani o‘zgartirgani." />
      <div className="a-filters">
        <select className="select select--sm" value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} aria-label="Obyekt">
          <option value="">Barcha obyektlar</option>
          {Object.entries(ENTITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="select select--sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Amal">
          <option value="">Barcha amallar</option>
          {Object.entries(ACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {error ? <ErrorNotice error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="a-panel a-panel--flush">
          <div className="a-table-wrap">
            <table className="a-table a-table--dense">
              <thead><tr><th>Vaqt</th><th>Xodim</th><th>Amal</th><th>Obyekt</th><th>Tafsilot</th><th>IP</th></tr></thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="a-nowrap">{fmtDateTime(r.created_at)}</td>
                    <td>{r.user?.full_name ?? <span className="a-muted">Tizim</span>}</td>
                    <td><span className={`tag ${r.action === 'delete' || r.action === 'login_failed' ? 'tag--outline' : r.action === 'create' ? 'tag--green' : 'tag--soft'}`}>{ACTION[r.action] ?? r.action}</span></td>
                    <td className="a-nowrap">{ENTITY[r.entity] ?? r.entity}{r.entity_id ? <span className="a-muted"> #{r.entity_id}</span> : null}</td>
                    <td><small className="a-clamp a-mono">{summary(r.details)}</small></td>
                    <td className="a-mono a-muted">{r.ip ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} />
        </div>
      )}
    </>
  );
}
