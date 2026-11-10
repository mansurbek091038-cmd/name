import { useEffect, useState } from 'react';
import { BarChart3, Building2, MessageSquareText, Save, Send, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { fmtDateTime } from '@/lib/format';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { Loading, PageHead, Panel, Toggle } from './ui';

type S = Record<string, string | boolean | null>;
interface Log { id: number; channel: string; event: string; ok: boolean; error?: string; created_at: string }
const SECRET = new Set(['telegram_bot_token', 'eskiz_password', 'turnstile_secret']);

export default function Settings() {
  const toast = useToast();
  const { data, error, reload } = useQuery<S>('/admin/settings');
  const { data: logs, reload: reloadLogs } = useQuery<Log[]>('/admin/settings/notifications');
  const [f, setF] = useState<S>({});
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => { if (data) setF(data); }, [data]);

  const save = async () => {
    setBusy(true); setErr(null);
    const body: S = {};
    for (const [k, v] of Object.entries(f)) {
      if (k.endsWith('_set')) continue;
      if (SECRET.has(k) && typeof v === 'string' && (v === '' || v === data?.[k] || /^[•*]+/.test(v))) continue; // unchanged masked secret
      if (v !== data?.[k]) body[k] = v;
    }
    try { await api.put('/admin/settings', body); invalidate('/admin/settings'); invalidate('/public/settings'); reload(); toast('Sozlamalar saqlandi'); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const test = async () => {
    setTesting(true);
    try { const r = await api.post<{ message?: string }>('/admin/settings/telegram/test'); toast(r?.message ?? 'Test xabari yuborildi'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setTesting(false); reloadLogs(); }
  };
  const text = (k: string, label: string, opts: { ph?: string; hint?: string; secret?: boolean } = {}) => (
    <div className="field a-half">
      <label className="field__label" htmlFor={`s-${k}`}>{label}</label>
      <input id={`s-${k}`} className="input input--sm" type={opts.secret ? 'password' : 'text'} autoComplete="new-password" placeholder={opts.secret && data?.[`${k}_set`] ? '•••••• o‘rnatilgan (yangisini kiriting)' : opts.ph} value={String(f[k] ?? '')}
        onFocus={(e) => { if (opts.secret && /^[•*]/.test(e.target.value)) setF({ ...f, [k]: '' }); }}
        onChange={(e) => setF({ ...f, [k]: e.target.value })} />
      {opts.hint && <span className="field__hint">{opts.hint}</span>}
    </div>
  );

  if (error) return <><PageHead title="Sozlamalar" /><ErrorNotice error={error} onRetry={reload} /></>;
  if (!data) return <Loading />;
  return (
    <>
      <PageHead eyebrow="Tizim" title={<>Sayt <em>sozlamalari</em></>} sub="Maxfiy kalitlar yashirilgan holda ko‘rsatiladi — o‘zgartirish uchun yangi qiymat kiriting."
        actions={<button type="button" className="btn btn--ink btn--sm" onClick={save} disabled={busy}>{busy ? <span className="spinner" /> : <Save />}Saqlash</button>} />
      {err != null && <ErrorNotice error={err} compact />}
      <div className="a-grid a-grid--2">
        <Panel title={<><Send className="a-inline-ico" />Telegram bildirishnomalar</>} actions={<button type="button" className="btn btn--gold btn--xs" onClick={test} disabled={testing}>{testing ? <span className="spinner" /> : <Send />}Test xabari</button>}>
          <div className="a-form">
            <div className="field"><Toggle checked={!!f.telegram_enabled} onChange={(v) => setF({ ...f, telegram_enabled: v })} label="Yangi ariza va yozilishlarni guruhga yuborish" /></div>
            {text('telegram_bot_token', 'Bot token', { secret: true, ph: '123456:ABC…' })}
            {text('telegram_chat_id', 'Chat ID', { ph: '-100…', hint: 'Bir nechta bo‘lsa vergul bilan' })}
          </div>
        </Panel>
        <Panel title={<><MessageSquareText className="a-inline-ico" />SMS (Eskiz)</>}>
          <div className="a-form">
            <div className="field"><Toggle checked={!!f.sms_enabled} onChange={(v) => setF({ ...f, sms_enabled: v })} label="Ota-onaga tasdiq SMS yuborish" /></div>
            {text('eskiz_email', 'Eskiz email')}
            {text('eskiz_password', 'Eskiz parol', { secret: true })}
            {text('eskiz_from', 'Jo‘natuvchi nomi', { ph: '4546' })}
          </div>
        </Panel>
        <Panel title={<><BarChart3 className="a-inline-ico" />Analitika</>}>
          <div className="a-form">
            {text('ga4_id', 'Google Analytics 4', { ph: 'G-XXXXXXX' })}
            {text('ym_id', 'Yandex Metrika', { ph: '12345678' })}
            {text('meta_pixel_id', 'Meta Pixel', { ph: '1234567890' })}
            <p className="field__hint" style={{ gridColumn: '1 / -1' }}>Skriptlar faqat ID kiritilganda saytga qo‘shiladi.</p>
          </div>
        </Panel>
        <Panel title={<><ShieldCheck className="a-inline-ico" />Cloudflare Turnstile (spamdan himoya)</>}>
          <div className="a-form">
            {text('turnstile_site_key', 'Site key')}
            {text('turnstile_secret', 'Secret', { secret: true })}
          </div>
        </Panel>
        <Panel title={<><Building2 className="a-inline-ico" />Aloqa ma’lumotlari</>} className="a-span-2">
          <div className="a-form">
            {text('site_name', 'Sayt nomi')}
            {text('phone', 'Telefon', { ph: '+998 90 994 74 07' })}
            {text('telegram', 'Telegram', { ph: 'https://t.me/…' })}
            {text('instagram', 'Instagram', { ph: 'https://instagram.com/…' })}
            <div className="field"><label className="field__label" htmlFor="s-address">Manzil</label><input id="s-address" className="input input--sm" value={String(f.address ?? '')} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          </div>
        </Panel>
        <Panel title="Bildirishnomalar jurnali" className="a-span-2">
          {!logs?.length ? <p className="a-muted">Hali yozuvlar yo‘q.</p> : (
            <ul className="a-log">
              {logs.slice(0, 12).map((l) => (
                <li key={l.id}><span className={`tag ${l.ok ? 'tag--green' : 'tag--outline'}`}>{l.ok ? 'OK' : 'Xato'}</span><b>{l.channel}</b><span>{l.event}</span>{l.error && <small className="a-danger-text">{l.error}</small>}<small className="a-muted">{fmtDateTime(l.created_at)}</small></li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
