import { useEffect, useState } from 'react';
import { Clock, HelpCircle, RotateCcw, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidate, useQuery } from '@/lib/query';
import { ErrorNotice, useToast } from '@/components/Feedback';
import { Loading, PageHead, Panel } from './ui';

interface SettingsData {
  work_hours_weekday?: string;
  work_hours_saturday?: string;
  working_hours?: string;
  [k: string]: unknown;
}

export default function WorkHours() {
  const toast = useToast();
  const { data, error, loading, reload } = useQuery<SettingsData>('/admin/settings');
  const [weekday, setWeekday] = useState('Du–Ju: 08:30–17:30');
  const [saturday, setSaturday] = useState('Sha: 08:30–12:00');
  const [workingHours, setWorkingHours] = useState('Du–Ju: 08:30–17:30, Sha: 08:30–12:00');
  const [busy, setBusy] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      if (typeof data.work_hours_weekday === 'string') setWeekday(data.work_hours_weekday);
      if (typeof data.work_hours_saturday === 'string') setSaturday(data.work_hours_saturday);
      if (typeof data.working_hours === 'string') setWorkingHours(data.working_hours);
    }
  }, [data]);

  const setDefault = () => {
    setWeekday('Du–Ju: 08:30–17:30');
    setSaturday('Sha: 08:30–12:00');
    setWorkingHours('Du–Ju: 08:30–17:30, Sha: 08:30–12:00');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setSaveErr(null);
    try {
      await api.put('/admin/settings', {
        work_hours_weekday: weekday.trim(),
        work_hours_saturday: saturday.trim(),
        working_hours: workingHours.trim(),
      });
      invalidate('/public/settings');
      invalidate('/admin/settings');
      reload();
      toast('Ish vaqti muvaffaqiyatli saqlandi');
    } catch (err) {
      setSaveErr((err as Error).message || 'Saqlashda xatolik yuz berdi');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <Loading />;

  return (
    <>
      <PageHead
        eyebrow="Sozlamalar"
        title={<>Ish vaqti <em>boshqaruvi</em></>}
        sub="Saytning aloqa, footer va boshqa bo‘limlaridagi ish vaqti ma’lumotlarini boshqarish."
      />

      {error && <ErrorNotice error={error} onRetry={reload} />}
      {saveErr && <div className="notice notice--error" style={{ marginBottom: 16 }}>{saveErr}</div>}

      <div className="a-grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}>
        <form onSubmit={save}>
          <Panel title={<><Clock className="a-inline-ico" />Ish vaqti parametrlarini o‘zgartirish</>}>
            <div className="a-form" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="field">
                <label className="field__label" htmlFor="wh-weekday">
                  Ish kunlari (Dushanba–Juma)
                </label>
                <input
                  id="wh-weekday"
                  className="input"
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                  placeholder="Du–Ju: 08:30–17:30"
                  required
                />
                <span className="field__hint">
                  Dushanbadan jumagacha bo‘lgan standart ish soatlari.
                </span>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="wh-saturday">
                  Shanba kuni
                </label>
                <input
                  id="wh-saturday"
                  className="input"
                  value={saturday}
                  onChange={(e) => setSaturday(e.target.value)}
                  placeholder="Sha: 08:30–12:00"
                  required
                />
                <span className="field__hint">
                  Shanba kunidagi qisqartirilgan ish soatlari.
                </span>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="wh-total">
                  Umumiy ish vaqti matni (sayt bo‘ylab ko‘rinadi)
                </label>
                <input
                  id="wh-total"
                  className="input"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="Du–Ju: 08:30–17:30, Sha: 08:30–12:00"
                  required
                />
                <span className="field__hint">
                  Saytning Footer va Aloqa bo‘limlarida to‘liq chiqariladigan qator.
                </span>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button
                  type="submit"
                  className="btn btn--gold"
                  disabled={busy}
                >
                  <Save />
                  {busy ? 'Saqlanmoqda…' : 'O‘zgarishlarni saqlash'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={setDefault}
                  disabled={busy}
                >
                  <RotateCcw />
                  Standart qiymatlarni tiklash
                </button>
              </div>
            </div>
          </Panel>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Panel title={<><HelpCircle className="a-inline-ico" />Saytdagi jonli ko‘rinishi</>}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p className="a-muted" style={{ fontSize: 13 }}>
                Admin paneldan kiritilgan ushbu ma’lumotlar darhol saytning barcha bo‘limlarida avtomatik aks etadi:
              </p>

              <div className="card" style={{ padding: 18, background: 'var(--surface-2)', borderRadius: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.08em' }}>
                  Aloqa bo‘limi kartochkasi:
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <span className="icon-tile icon-tile--soft"><Clock /></span>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Ish vaqti</span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                      {workingHours || `${weekday}, ${saturday}`}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 18, background: 'var(--navy)', color: '#fff', borderRadius: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--gold-2)', letterSpacing: '0.08em' }}>
                  Sayt Footeri (pastki qism):
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, fontSize: 14 }}>
                  <Clock style={{ width: 16, height: 16, color: 'var(--gold-2)' }} />
                  <span>{workingHours || `${weekday}, ${saturday}`}</span>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
