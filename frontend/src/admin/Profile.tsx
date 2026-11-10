import { useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '@/lib/api';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { ROLE_LABEL, useAuth } from './auth';
import { PageHead, Panel } from './ui';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [setup, setSetup] = useState<{ secret: string; otpauth_url: string; qr_svg: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [pw, setPw] = useState({ current_password: '', new_password: '', repeat: '' });
  const [pwErr, setPwErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => { setErr(null); try { setSetup(await api.post('/auth/2fa/setup')); } catch (e) { setErr(e); } };
  const enable = async () => { setErr(null); try { await api.post('/auth/2fa/enable', { otp }); setSetup(null); setOtp(''); await refresh(); toast('2FA yoqildi'); } catch (e) { setErr(e); } };
  const disable = async () => { setErr(null); try { await api.post('/auth/2fa/disable', { otp }); setOtp(''); await refresh(); toast('2FA o‘chirildi'); } catch (e) { setErr(e); } };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault(); setPwErr(null);
    if (pw.new_password !== pw.repeat) { setPwErr(new Error('Yangi parollar mos emas')); return; }
    setBusy(true);
    try { await api.post('/auth/change-password', { current_password: pw.current_password, new_password: pw.new_password }); setPw({ current_password: '', new_password: '', repeat: '' }); toast('Parol o‘zgartirildi'); }
    catch (x) { setPwErr(x); } finally { setBusy(false); }
  };
  if (!user) return null;
  // qr_svg comes from our own backend (server-generated SVG)
  const qr = setup?.qr_svg ? (setup.qr_svg.trim().startsWith('<') ? setup.qr_svg : atob(setup.qr_svg.replace(/^data:image\/svg\+xml;base64,/, ''))) : '';

  return (
    <>
      <PageHead eyebrow={ROLE_LABEL[user.role]} title={user.full_name} sub={user.email} />
      <div className="a-grid a-grid--2">
        <Panel title={<><ShieldCheck className="a-inline-ico" />Ikki bosqichli tasdiqlash (2FA)</>}>
          {user.two_fa_enabled ? (
            <div className="a-form">
              <p className="a-ok-line"><ShieldCheck />2FA yoqilgan. Kirishda autentifikator kodi so‘raladi.</p>
              <div className="field a-half"><label className="field__label" htmlFor="p-otp">O‘chirish uchun joriy kod</label><input id="p-otp" className="input input--sm a-otp-sm" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} /></div>
              <div className="field a-half" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn--ghost btn--sm a-danger-text" disabled={otp.length < 6} onClick={disable}><ShieldOff />2FA ni o‘chirish</button></div>
            </div>
          ) : setup ? (
            <div className="a-2fa">
              <div className="a-2fa__qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <div>
                <p>Google Authenticator yoki boshqa ilova bilan QR-kodni skanerlang, so‘ng 6 xonali kodni kiriting.</p>
                <p className="a-muted a-small">Qo‘lda kiritish: <code className="a-mono">{setup.secret}</code></p>
                <div className="a-inline" style={{ marginTop: 12 }}>
                  <input className="input input--sm a-otp-sm" inputMode="numeric" maxLength={6} placeholder="000000" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} aria-label="Kod" />
                  <button type="button" className="btn btn--ink btn--sm" disabled={otp.length < 6} onClick={enable}>Yoqish</button>
                </div>
              </div>
            </div>
          ) : (
            <div><p className="a-muted">Hisobingizni parol o‘g‘irlanishidan himoya qiling: kirishda telefoningizdagi kod ham so‘raladi.</p>
              <button type="button" className="btn btn--gold btn--sm" style={{ marginTop: 14 }} onClick={start}><ShieldCheck />2FA ni sozlash</button></div>
          )}
          {err != null && <div style={{ marginTop: 12 }}><ErrorNotice error={err} compact /></div>}
        </Panel>
        <Panel title={<><KeyRound className="a-inline-ico" />Parolni o‘zgartirish</>}>
          <form className="a-form" onSubmit={changePw}>
            <div className="field"><label className="field__label" htmlFor="p-cur">Joriy parol</label><input id="p-cur" type="password" autoComplete="current-password" className="input input--sm" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></div>
            <div className="field a-half"><label className="field__label" htmlFor="p-new">Yangi parol</label><input id="p-new" type="password" autoComplete="new-password" className="input input--sm" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></div>
            <div className="field a-half"><label className="field__label" htmlFor="p-rep">Takrorlang</label><input id="p-rep" type="password" autoComplete="new-password" className="input input--sm" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} /></div>
            <div className="field"><button type="submit" className="btn btn--ink btn--sm" disabled={busy || !pw.current_password || pw.new_password.length < 8}>{busy && <span className="spinner" />}Saqlash</button></div>
          </form>
          {pwErr != null && <ErrorNotice error={pwErr} compact />}
        </Panel>
      </div>
    </>
  );
}
