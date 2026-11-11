import { useState } from 'react';
import { BookOpen, Check, Phone, Trash2, User, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { fmtDateTime, prettyPhone, telHref } from '@/lib/format';
import type { CourseEnrollment, Paged } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { Empty, Loading, PageHead, Pagination, useConfirm } from './ui';
import ResourcePage from './Resource';

export default function CoursesAdmin() {
  const [tab, setTab] = useState<'courses' | 'enrollments'>('courses');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div className="seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'courses'}
            onClick={() => setTab('courses')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <BookOpen style={{ width: 15, height: 15 }} />
            <span>Kurslar ro‘yxati</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'enrollments'}
            onClick={() => setTab('enrollments')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Users style={{ width: 15, height: 15 }} />
            <span>Kurslarga yozilganlar</span>
          </button>
        </div>
      </div>

      {tab === 'courses' ? (
        <ResourcePage resource="courses" />
      ) : (
        <EnrollmentsList />
      )}
    </>
  );
}

function EnrollmentsList() {
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState(1);
  const [handledFilter, setHandledFilter] = useState<'all' | 'pending' | 'handled'>('all');

  const params: Record<string, string | number | boolean | null | undefined> = { page, page_size: 20 };
  if (handledFilter === 'pending') params.handled = 'false';
  if (handledFilter === 'handled') params.handled = 'true';

  const { data, error, loading, reload } = useQuery<Paged<CourseEnrollment>>('/admin/courses/enrollments', params, { keepPrevious: true });

  const toggleHandled = async (item: CourseEnrollment) => {
    try {
      await api.patch(`/admin/courses/enrollments/${item.id}`, { handled: !item.handled });
      invalidate('/admin/courses/enrollments');
      reload();
      toast(item.handled ? 'Ko‘rib chiqilmagan holatiga qaytarildi' : 'Ko‘rib chiqildi deb belgilandi');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const remove = async (item: CourseEnrollment) => {
    if (!(await confirm(`«${item.name}» arizasini o‘chirishni tasdiqlaysizmi?`, { danger: true, ok: 'O‘chirish' }))) return;
    try {
      await api.del(`/admin/courses/enrollments/${item.id}`);
      invalidate('/admin/courses/enrollments');
      reload();
      toast('Ariza o‘chirildi');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const items = data?.items ?? [];

  return (
    <>
      <PageHead
        eyebrow="Arizalar"
        title={<>Kurslarga <em>yozilganlar</em></>}
        sub="Saytdan maxsus kurslarga kelib tushgan arizalar ro‘yxati."
      />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button
          type="button"
          className={`btn btn--sm ${handledFilter === 'all' ? 'btn--ink' : 'btn--ghost'}`}
          onClick={() => { setHandledFilter('all'); setPage(1); }}
        >
          Barchasi ({data?.total ?? 0})
        </button>
        <button
          type="button"
          className={`btn btn--sm ${handledFilter === 'pending' ? 'btn--ink' : 'btn--ghost'}`}
          onClick={() => { setHandledFilter('pending'); setPage(1); }}
        >
          Yangi arizalar
        </button>
        <button
          type="button"
          className={`btn btn--sm ${handledFilter === 'handled' ? 'btn--ink' : 'btn--ghost'}`}
          onClick={() => { setHandledFilter('handled'); setPage(1); }}
        >
          Bog‘lanilganlar
        </button>
      </div>

      {error && <ErrorNotice error={error} onRetry={reload} />}
      {loading && !data && <Loading />}

      {!loading && !items.length ? (
        <Empty>Hozircha kurslarga yozilganlar yo‘q.</Empty>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="a-table-wrap">
            <table className="a-table">
              <thead>
                <tr>
                  <th>F.I.Sh.</th>
                  <th>Telefon</th>
                  <th>Tanlangan kurs</th>
                  <th>Izoh</th>
                  <th>Yuborilgan sana</th>
                  <th>Holat</th>
                  <th style={{ textAlign: 'right' }}>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <User style={{ width: 16, height: 16, color: 'var(--muted)' }} />
                        <b>{it.name}</b>
                      </div>
                    </td>
                    <td>
                      <a href={telHref(it.phone)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                        <Phone style={{ width: 14, height: 14 }} />
                        {prettyPhone(it.phone)}
                      </a>
                    </td>
                    <td>
                      <span className="tag tag--gold">{it.course_name || `Kurs #${it.course_id}`}</span>
                    </td>
                    <td>
                      <span className="a-clamp" style={{ maxWidth: 220, fontSize: 13, color: 'var(--text-2)' }}>
                        {it.comment || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="a-nowrap" style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {it.created_at ? fmtDateTime(it.created_at) : '—'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => toggleHandled(it)}
                        className={`tag ${it.handled ? 'tag--green' : 'tag--gold'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        title="Holatni o‘zgartirish uchun bosing"
                      >
                        {it.handled ? <><Check style={{ width: 12, height: 12 }} /> Bog‘lanildi</> : 'Kutilmoqda'}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm"
                        onClick={() => remove(it)}
                        aria-label="O‘chirish"
                        title="O‘chirish"
                      >
                        <Trash2 style={{ width: 16, height: 16 }} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && data.pages > 1 && (
            <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} />
          )}
        </div>
      )}
    </>
  );
}
