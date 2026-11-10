import { useState } from 'react';
import { Check, Phone, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { fmtDateTime, prettyPhone, telHref } from '@/lib/format';
import type { Paged } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { Empty, Loading, PageHead, Pagination } from './ui';

interface Msg { id: number; name: string; phone: string; message: string; is_handled: boolean; created_at: string }

export default function Messages() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, error, reload } = useQuery<Paged<Msg>>('/admin/contact-messages', { page, page_size: 20 }, { keepPrevious: true });
  const mark = async (m: Msg, v: boolean) => {
    try { await api.patch(`/admin/contact-messages/${m.id}`, { is_handled: v }); invalidate('/admin/contact-messages'); reload(); toast(v ? 'Ko‘rib chiqildi' : 'Qayta ochildi'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <>
      <PageHead eyebrow="Aloqa formasi" title={<>Kelgan <em>xabarlar</em></>} sub="Saytdagi «Bizga yozing» formasidan." />
      {error ? <ErrorNotice error={error} onRetry={reload} /> : !data ? <Loading /> : !data.items.length ? <Empty>Xabarlar yo‘q.</Empty> : (
        <>
          <ul className="a-msgs">
            {data.items.map((m) => (
              <li key={m.id} className={m.is_handled ? 'is-done' : ''}>
                <div className="a-msgs__head">
                  <b>{m.name}</b>
                  <a href={telHref(m.phone)} className="a-link"><Phone />{prettyPhone(m.phone)}</a>
                  <small>{fmtDateTime(m.created_at)}</small>
                  {m.is_handled
                    ? <button type="button" className="btn btn--ghost btn--xs" onClick={() => mark(m, false)}><RotateCcw />Qayta ochish</button>
                    : <button type="button" className="btn btn--ink btn--xs" onClick={() => mark(m, true)}><Check />Ko‘rib chiqildi</button>}
                </div>
                <p>{m.message}</p>
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={data.pages} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
