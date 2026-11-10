import { Link } from 'react-router';
import { ArrowRight, CalendarCheck, ClipboardList, Percent, Sparkles, TrendingUp, Users } from 'lucide-react';
import { useQuery } from '@/lib/query';
import { fmtDateTime, prettyPhone } from '@/lib/format';
import type { Dashboard as D } from '@/lib/types';
import { ErrorNotice } from '@/components/Feedback';
import { Counter } from '@/components/Motion';
import { useAuth } from './auth';
import { AreaChart, Donut, HBars, VBars } from './charts';
import { Loading, PageHead, Panel, STATUS, STATUS_KEYS, StatusBadge } from './ui';

const SOURCE_LABEL: Record<string, string> = { direct: 'To‘g‘ridan-to‘g‘ri', instagram: 'Instagram', telegram: 'Telegram', facebook: 'Facebook', google: 'Google', youtube: 'YouTube' };
const gradeTxt = (g: unknown) => (String(g) === '0' ? 'Tayyorlov' : `${g}-sinf`);

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useQuery<D>('/admin/reports/dashboard');
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';

  if (error) return <><PageHead title="Dashboard" /><ErrorNotice error={error} onRetry={reload} /></>;
  if (loading || !data) return <Loading />;
  const t = data.totals;
  const last30 = data.by_day.reduce((s, d) => s + d.count, 0);
  const grades = [...data.by_grade].sort((a, b) => Number(a.grade) - Number(b.grade));

  return (
    <>
      <PageHead eyebrow={`${hello}, ${user?.full_name.split(' ')[0]}`} title={<>Qabul <em>ko‘rsatkichlari</em></>} sub="So‘nggi 30 kunlik holat va arizalar oqimi."
        actions={<Link className="btn btn--ink btn--sm" to="/admin/arizalar"><ClipboardList />Arizalar</Link>} />
      <div className="a-kpis">
        <Kpi icon={<Users />} label="Jami arizalar" value={t.admissions} />
        <Kpi icon={<Sparkles />} label="Bugun yangi" value={t.new_today} accent />
        <Kpi icon={<TrendingUp />} label="Shu oy" value={t.this_month} />
        <Kpi icon={<Percent />} label="Konversiya (shartnoma)" value={t.conversion_rate} suffix="%" />
        <Kpi icon={<CalendarCheck />} label="Kelgusi ekskursiyalar" value={t.tours_upcoming} sub={`${t.bookings_upcoming} ta yozilish`} />
      </div>
      <div className="a-grid a-grid--dash">
        <Panel title={<>Arizalar dinamikasi <small className="a-muted">· 30 kun, jami {last30}</small></>} className="a-span-2">
          <AreaChart data={data.by_day} />
        </Panel>
        <Panel title="Holatlar bo‘yicha">
          <Donut items={STATUS_KEYS.map((k) => ({ label: STATUS[k].label, color: STATUS[k].color, value: data.by_status.find((s) => s.status === k)?.count ?? 0 }))} />
        </Panel>
        <Panel title="Manbalar (UTM)">
          <HBars items={data.by_source.map((s) => ({ label: SOURCE_LABEL[s.source ?? 'direct'] ?? s.source ?? '—', value: s.count }))} />
        </Panel>
        <Panel title="Sinflar bo‘yicha">
          <VBars items={grades.map((g) => ({ label: String(g.grade) === '0' ? 'T' : String(g.grade), value: g.count }))} />
        </Panel>
        <Panel title="So‘nggi arizalar" actions={<Link className="btn btn--text" to="/admin/arizalar">Barchasi<ArrowRight /></Link>}>
          <ul className="a-recent">
            {data.recent.map((a) => (
              <li key={a.id}>
                <Link to={`/admin/arizalar?open=${a.id}`}>
                  <span className="a-recent__av" aria-hidden="true">{a.child_name[0]}</span>
                  <span className="a-recent__txt"><b>{a.child_name}</b><small>{a.parent_name} · {prettyPhone(a.phone)} · {gradeTxt(a.target_grade)}</small></span>
                  <span className="a-recent__meta"><StatusBadge s={a.status} /><small>{fmtDateTime(a.created_at)}</small></span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, suffix, sub, accent }: { icon: React.ReactNode; label: string; value: number; suffix?: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`a-kpi${accent ? ' a-kpi--accent' : ''}`}>
      <span className="a-kpi__ico" aria-hidden="true">{icon}</span>
      <span className="a-kpi__lbl">{label}</span>
      <b className="a-kpi__val serif"><Counter value={value} duration={1.1} />{suffix}</b>
      {sub && <small className="a-kpi__sub">{sub}</small>}
    </div>
  );
}
