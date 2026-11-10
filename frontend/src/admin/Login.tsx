import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { ArrowLeft, KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { ErrorNotice } from '@/components/Feedback';
import { useAuth } from './auth';

export default function Login() {
  const { login, user, ready } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get('next') || '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'creds' | 'otp'>('creds');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (step === 'otp') setTimeout(() => otpRef.current?.focus(), 50); }, [step]);

  if (ready && user) return <Navigate to={next.startsWith('/admin') ? next : '/admin'} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await login(email.trim(), password, step === 'otp' ? otp.replace(/\s/g, '') : undefined);
      nav(next.startsWith('/admin') ? next : '/admin', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'OTP_REQUIRED') { setStep('otp'); setError(null); }
      else setError(err);
      if (err instanceof ApiError && err.code === 'INVALID_OTP') setOtp('');
    } finally { setBusy(false); }
  };

  return (
    <div className="a-login">
      <div className="a-login__art" aria-hidden="true">
        <div className="a-login__ring" />
        <img src="/brand/logo-384.webp" alt="" width={220} height={220} />
        <p className="serif">«Ilm axloq bilan olinsagina foyda beradi»</p>
      </div>
      <m.form className="a-login__card" onSubmit={submit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} noValidate>
        <img className="a-login__logo" src="/brand/logo-192.webp" alt="" width={56} height={56} />
        <span className="eyebrow eyebrow--plain">Smart Start · xodimlar uchun</span>
        <AnimatePresence mode="wait" initial={false}>
          {step === 'creds' ? (
            <m.div key="c" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="h3">Tizimga kirish</h1>
              <p className="muted">Faqat maktab xodimlari va ma’muriyat uchun.</p>
              <div className="field" style={{ marginTop: 22 }}>
                <label className="field__label" htmlFor="lg-email">Email</label>
                <input id="lg-email" className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@smartstart.uz" />
              </div>
              <div className="field" style={{ marginTop: 14 }}>
                <label className="field__label" htmlFor="lg-pass">Parol</label>
                <input id="lg-pass" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </m.div>
          ) : (
            <m.div key="o" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <h1 className="h3"><ShieldCheck className="a-inline-ico" /> Ikki bosqichli tasdiqlash</h1>
              <p className="muted">Autentifikator ilovasidagi 6 xonali kodni kiriting.</p>
              <div className="field" style={{ marginTop: 22 }}>
                <label className="field__label" htmlFor="lg-otp">Tasdiqlash kodi</label>
                <input ref={otpRef} id="lg-otp" className="input a-otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={7} value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))} placeholder="••••••" />
              </div>
              <button type="button" className="btn btn--text" style={{ marginTop: 10 }} onClick={() => { setStep('creds'); setOtp(''); }}><ArrowLeft />Orqaga</button>
            </m.div>
          )}
        </AnimatePresence>
        {error != null && <div style={{ marginTop: 16 }}><ErrorNotice error={error} compact /></div>}
        <button type="submit" className="btn btn--ink btn--lg btn--block" style={{ marginTop: 22 }} disabled={busy || !email || !password || (step === 'otp' && otp.length < 6)}>
          {busy ? <span className="spinner" /> : step === 'otp' ? <KeyRound /> : <LogIn />}
          {step === 'otp' ? 'Tasdiqlash' : 'Kirish'}
        </button>
        <a className="btn btn--text a-login__back" href="/"><ArrowLeft />Saytga qaytish</a>
      </m.form>
    </div>
  );
}
