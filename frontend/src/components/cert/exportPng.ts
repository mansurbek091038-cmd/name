import type { Dict } from '@/i18n/dict';
import type { Certificate, Lang } from '@/lib/types';
import { fmtDate, gradeLabel, img } from '@/lib/format';
import { scoreText, subRows, typeLabel } from './certUtils';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

/** Branded PNG summary card (ivory / navy / gold) with the certificate image. */
export async function exportCertPng(c: Certificate, t: Dict, lang: Lang) {
  const W = 1600, H = 1000;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  if (!x) return;
  await document.fonts?.ready;

  x.fillStyle = '#FBF8F1'; x.fillRect(0, 0, W, H);
  // navy side panel
  x.fillStyle = '#0D1B36'; x.fillRect(0, 0, 620, H);
  const g = x.createRadialGradient(560, 80, 10, 560, 80, 380);
  g.addColorStop(0, 'rgba(232,184,74,.35)'); g.addColorStop(1, 'rgba(232,184,74,0)');
  x.fillStyle = g; x.fillRect(0, 0, 620, H);

  const src = img(c.image, 'large') ?? img(c.image, 'medium');
  const pic = src ? await loadImage(src) : null;
  if (pic) {
    const bw = 460, bh = 640, bx = 80, by = 180;
    const r = Math.min(bw / pic.width, bh / pic.height);
    const dw = pic.width * r, dh = pic.height * r;
    x.save();
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 50; x.shadowOffsetY = 24;
    x.fillStyle = '#fff';
    x.fillRect(bx + (bw - dw) / 2 - 10, by + (bh - dh) / 2 - 10, dw + 20, dh + 20);
    x.restore();
    x.drawImage(pic, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh);
  }
  const logo = await loadImage('/brand/logo-192.webp');
  if (logo) x.drawImage(logo, 80, 64, 76, 76);
  x.fillStyle = '#fff'; x.font = '700 34px Lora, Georgia, serif'; x.fillText('Smart Start', 172, 104);
  x.fillStyle = '#E8B84A'; x.font = '800 15px Manrope, sans-serif'; x.fillText(t.schoolSub.split('').join(' '), 174, 132);

  // right side
  const L = 700;
  x.fillStyle = '#8A6212'; x.font = '800 18px Manrope, sans-serif';
  x.fillText(t.certifies.toUpperCase(), L, 170);
  x.fillStyle = '#0D1B36'; x.font = '700 64px Lora, Georgia, serif';
  x.fillText(c.student_name, L, 250, W - L - 80);
  x.fillStyle = '#5F6880'; x.font = '600 24px Manrope, sans-serif';
  x.fillText([gradeLabel(c.grade, t, lang), c.date ? fmtDate(c.date, lang) : c.year].filter(Boolean).join('  ·  '), L, 300);

  x.fillStyle = '#B07F1E'; x.font = 'italic 600 150px Lora, Georgia, serif';
  x.fillText(scoreText(c, t), L - 6, 470);
  x.fillStyle = '#0D1B36'; x.font = '800 26px Manrope, sans-serif';
  x.fillText(typeLabel(c.type, t) + (c.subject ? ` · ${c.subject}` : ''), L, 525);

  let y = 600;
  for (const s of subRows(c, t)) {
    x.fillStyle = '#3F4A63'; x.font = '700 22px Manrope, sans-serif'; x.fillText(s.label, L, y);
    x.fillStyle = '#EBE3D2'; x.fillRect(L + 230, y - 16, 460, 14);
    x.fillStyle = '#C9962B'; x.fillRect(L + 230, y - 16, 460 * (s.pct / 100), 14);
    x.fillStyle = '#0D1B36'; x.font = '800 24px Manrope, sans-serif'; x.fillText(s.value, L + 710, y);
    y += 46;
  }
  x.fillStyle = '#E6DFCF'; x.fillRect(L, H - 150, W - L - 80, 2);
  x.fillStyle = '#5F6880'; x.font = '600 20px Manrope, sans-serif';
  const foot = [c.teacher ? `${t.mentor}: ${c.teacher}` : '', c.cert_number_masked ? `${t.certNo}: ${c.cert_number_masked}` : ''].filter(Boolean).join('   ·   ');
  x.fillText(foot, L, H - 100);
  x.fillStyle = '#8A6212'; x.font = '800 20px Manrope, sans-serif';
  x.fillText(location.host || 'smartstart.uz', L, H - 64);

  const a = document.createElement('a');
  a.download = `SmartStart_${c.student_name.replace(/\s+/g, '_')}_${c.type}.png`;
  try { a.href = cv.toDataURL('image/png'); } catch { return; }
  document.body.appendChild(a); a.click(); a.remove();
}
