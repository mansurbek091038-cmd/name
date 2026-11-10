/* Hand-made SVG charts (no chart lib) in the ivory / navy / gold language. */
import { useId, useMemo, useState } from 'react';
import { m } from 'motion/react';

const fmtDay = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; };

export function AreaChart({ data, height = 220 }: { data: { date: string; count: number }[]; height?: number }) {
  const W = 720, H = height, P = { l: 34, r: 12, t: 16, b: 26 };
  const gid = useId().replace(/:/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(4, ...data.map((d) => d.count));
  const nice = Math.ceil(max / 4) * 4;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, data.length - 1);
  const y = (v: number) => P.t + (1 - v / nice) * (H - P.t - P.b);
  const path = useMemo(() => {
    if (!data.length) return '';
    // monotone cubic (Fritsch–Carlson): smooth but never overshoots below zero
    const xs = data.map((_, i) => x(i)), ys = data.map((d) => y(d.count)), n = data.length;
    const dx = xs.slice(1).map((v, i) => v - xs[i]);
    const sl = ys.slice(1).map((v, i) => (v - ys[i]) / dx[i]);
    const m = ys.map((_, i) => (i === 0 ? sl[0] : i === n - 1 ? sl[n - 2] : sl[i - 1] * sl[i] <= 0 ? 0 : (sl[i - 1] + sl[i]) / 2)) as number[];
    for (let i = 0; i < n - 1; i++) {
      if (sl[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / sl[i], b = m[i + 1] / sl[i], h = Math.hypot(a, b);
      if (h > 3) { m[i] = (3 * a * sl[i]) / h; m[i + 1] = (3 * b * sl[i]) / h; }
    }
    let d = `M${xs[0]},${ys[0]}`;
    for (let i = 0; i < n - 1; i++) d += ` C${xs[i] + dx[i] / 3},${ys[i] + (m[i] * dx[i]) / 3} ${xs[i + 1] - dx[i] / 3},${ys[i + 1] - (m[i + 1] * dx[i]) / 3} ${xs[i + 1]},${ys[i + 1]}`;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, nice]);
  const area = path ? `${path} L${x(data.length - 1)},${H - P.b} L${x(0)},${H - P.b} Z` : '';
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="a-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`So‘nggi ${data.length} kun: jami ${total} ta ariza`} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#E8B84A" stopOpacity=".35" />
            <stop offset="1" stopColor="#E8B84A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={P.l} x2={W - P.r} y1={y(nice * f)} y2={y(nice * f)} className="a-chart__grid" />
            <text x={P.l - 8} y={y(nice * f) + 4} textAnchor="end" className="a-chart__tick">{Math.round(nice * f)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % 5 === 0 || i === data.length - 1) && (
          <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" className="a-chart__tick">{fmtDay(d.date)}</text>
        ))}
        <m.path d={area} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        <m.path d={path} fill="none" stroke="#C9962B" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.22, 0.8, 0.24, 1] }} />
        {data.map((_, i) => (
          <rect key={i} x={x(i) - (W - P.l - P.r) / data.length / 2} y={P.t} width={(W - P.l - P.r) / data.length} height={H - P.t - P.b} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && data[hover] && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="currentColor" strokeOpacity=".2" />
            <circle cx={x(hover)} cy={y(data[hover].count)} r="5" fill="#C9962B" stroke="var(--surface)" strokeWidth="2" />
            <g transform={`translate(${Math.min(W - 110, Math.max(P.l, x(hover) - 50))},${Math.max(P.t, y(data[hover].count) - 46)})`}>
              <rect width="100" height="36" rx="9" className="a-chart__tip" />
              <text x="50" y="15" textAnchor="middle" className="a-chart__tiptxt">{fmtDay(data[hover].date)}</text>
              <text x="50" y="29" textAnchor="middle" className="a-chart__tipnum">{data[hover].count} ta ariza</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

export function Donut({ items, size = 180 }: { items: { label: string; value: number; color: string }[]; size?: number }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const r = 70, c = 2 * Math.PI * r;
  let acc = 0;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="a-donut">
      <svg viewBox="0 0 180 180" width={size} height={size} role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(', ')}>
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--bg-2)" strokeWidth="22" />
        {items.map((it, i) => {
          const len = (it.value / total) * c;
          const off = acc;
          acc += len;
          if (!it.value) return null;
          return (
            <m.circle key={it.label} cx="90" cy="90" r={r} fill="none" stroke={it.color} strokeWidth={hover === i ? 28 : 22}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`} transform="rotate(-90 90 90)"
              initial={{ strokeDashoffset: 0, opacity: 0 }} animate={{ strokeDashoffset: -off, opacity: 1 }} transition={{ duration: 0.9, delay: i * 0.06 }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ transition: 'stroke-width .2s' }} />
          );
        })}
        <text x="90" y="86" textAnchor="middle" className="a-donut__num">{hover !== null ? items[hover].value : total === 1 && !items.some((i) => i.value) ? 0 : total}</text>
        <text x="90" y="106" textAnchor="middle" className="a-donut__lbl">{hover !== null ? items[hover].label : 'jami'}</text>
      </svg>
      <ul className="a-legend">
        {items.map((it, i) => (
          <li key={it.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? 'is-on' : ''}>
            <i style={{ background: it.color }} />{it.label}<b>{it.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ items, color = '#22314F' }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="a-hbars">
      {items.map((it, i) => (
        <li key={it.label}>
          <span className="a-hbars__lbl">{it.label}</span>
          <span className="a-hbars__track"><m.i style={{ background: i === 0 ? '#C9962B' : color }} initial={{ width: 0 }} animate={{ width: `${(it.value / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.05 }} /></span>
          <b>{it.value}</b>
        </li>
      ))}
    </ul>
  );
}

export function VBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="a-vbars" role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(', ')}>
      {items.map((it, i) => (
        <div key={it.label} className="a-vbars__col">
          <b>{it.value || ''}</b>
          <span className="a-vbars__track"><m.i initial={{ height: 0 }} animate={{ height: `${(it.value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.04 }} /></span>
          <small>{it.label}</small>
        </div>
      ))}
    </div>
  );
}
