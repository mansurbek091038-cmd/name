import { useEffect, useState } from 'react';
import { KeyRound, Pencil, ShieldCheck, ShieldOff, Trash2, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { fmtDateTime } from '@/lib/format';
import type { Paged, Role, User } from '@/lib/types';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { ROLE_LABEL, useAuth } from './auth';
import { Drawer, Loading, PageHead, Toggle, useConfirm } from './ui';

type U = User & { last_login_at?: string | null };

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, reload } = useQuery<Paged<U>>('/admin/users', { page_size: 100 });
  const [edit, setEdit] = useState<Partial<U> & { password?: string } | null>(null);
  const refresh = () => { invalidate('/admin/users'); invalidate('/admin/staff'); reload(); };
  const del = async (u: U) => {
    if (!(await confirm(`${u.full_name} (${u.email}) o‘chirilsinmi?`, { danger: true, ok: 'O‘chirish' }))) return;
    try { await api.del(`/admin/users/${u.id}`); toast('O‘chirildi'); refresh(); } catch (e) { toast((e as Error).message, 'error'); }
  };
  return (
    <>
      <PageHead eyebrow="Tizim" title={<>Xodimlar va <em>rollar</em></>} sub="Menejer — arizalar va kontent; administrator — hisobotlar, eksport, sozlamalar; super admin — foydalanuvchilar."
        actions={<button type="button" className="btn btn--gold btn--sm" onClick={() => setEdit({ role: 'manager', is_active: true })}><UserPlus />Xodim qo‘shish</button>} />
      {error ? <ErrorNotice error={error} onRetry={reload} /> : !data ? <Loading /> : (
        <div className="a-panel a-panel--flush"><div className="a-table-wrap">
          <table className="a-table">
            <thead><tr><th>Xodim</th><th>Rol</th><th>2FA</th><th>Holat</th><th>Oxirgi kirish</th><th className="a-actions-col"><span className="sr-only">Amallar</span></th></tr></thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id} onClick={() => setEdit(u)} tabIndex={0}>
                  <td><b>{u.full_name}{u.id === me?.id && <span className="tag tag--soft" style={{ marginLeft: 8 }}>siz</span>}</b><small>{u.email}</small></td>
                  <td><span className={`tag ${u.role === 'super_admin' ? 'tag--gold' : u.role === 'admin' ? '' : 'tag--soft'}`}>{ROLE_LABEL[u.role]}</span></td>
                  <td>{u.two_fa_enabled ? <span className="tag tag--green"><ShieldCheck />Yoqilgan</span> : <span className="a-muted">—</span>}</td>
                  <td>{u.is_active ? <span className="tag tag--green">Faol</span> : <span className="tag tag--outline">Bloklangan</span>}</td>
                  <td className="a-nowrap">{u.last_login_at ? fmtDateTime(u.last_login_at) : '—'}</td>
                  <td className="a-actions-col" onClick={(e) => e.stopPropagation()}>
                    <div className="a-row-actions">
                      <button type="button" className="icon-btn" aria-label="Tahrirlash" onClick={() => setEdit(u)}><Pencil /></button>
                      {u.id !== me?.id && <button type="button" className="icon-btn a-danger-text" aria-label="O‘chirish" onClick={() => del(u)}><Trash2 /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}
      <UserForm u={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />
    </>
  );
}

function UserForm({ u, onClose, onSaved }: { u: (Partial<U> & { password?: string }) | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<U> & { password?: string }>({});
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (u) { setF({ ...u, password: '' }); setErr(null); } }, [u]);
  const isNew = !u?.id;
  const save = async () => {
    setBusy(true); setErr(null);
    const body: Record<string, unknown> = { email: f.email, full_name: f.full_name, role: f.role, is_active: f.is_active };
    if (f.password) body.password = f.password;
    try { if (isNew) await api.post('/admin/users', body); else await api.put(`/admin/users/${u!.id}`, body); toast('Saqlandi'); onSaved(); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const reset2fa = async () => {
    try { await api.put(`/admin/users/${u!.id}`, { two_fa_enabled: false }); toast('2FA o‘chirildi'); onSaved(); } catch (e) { setErr(e); }
  };
  return (
    <Drawer open={!!u} onClose={onClose} width={520} title={isNew ? 'Yangi xodim' : f.full_name ?? ''} sub={isNew ? undefined : f.email}
      footer={<><button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>Yopish</button><button type="button" className="btn btn--ink btn--sm" disabled={busy} onClick={save}>{busy && <span className="spinner" />}Saqlash</button></>}>
      <form className="a-form" onSubmit={(e) => { e.preventDefault(); save(); }} autoComplete="off">
        <div className="field"><label className="field__label" htmlFor="u-name">F.I.Sh.</label><input id="u-name" className="input input--sm" value={f.full_name ?? ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="field"><label className="field__label" htmlFor="u-email">Email</label><input id="u-email" type="email" className="input input--sm" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field a-half"><label className="field__label" htmlFor="u-role">Rol</label>
          <select id="u-role" className="select select--sm" value={f.role ?? 'manager'} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {(['manager', 'admin', 'super_admin'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select></div>
        <div className="field a-half" style={{ justifyContent: 'flex-end' }}><Toggle checked={f.is_active ?? true} onChange={(v) => setF({ ...f, is_active: v })} label="Faol" /></div>
        <div className="field"><label className="field__label" htmlFor="u-pass">{isNew ? 'Parol' : 'Yangi parol'} <small>{isNew ? 'kamida 8 belgi' : 'bo‘sh qoldirilsa o‘zgarmaydi'}</small></label>
          <input id="u-pass" type="password" autoComplete="new-password" className="input input--sm" value={f.password ?? ''} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
      </form>
      {!isNew && f.two_fa_enabled && (
        <div className="a-note"><ShieldOff /><span>Xodim autentifikatorini yo‘qotgan bo‘lsa, 2FA ni o‘chirib qo‘ying.</span><button type="button" className="btn btn--ghost btn--xs" onClick={reset2fa}><KeyRound />2FA ni o‘chirish</button></div>
      )}
      {err != null && <ErrorNotice error={err} compact />}
    </Drawer>
  );
}
