import { Link } from 'react-router';
import { ArrowUpRight, Clock, MapPin, Phone, Send } from 'lucide-react';
import { Em, useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { prettyPhone, telHref } from '@/lib/format';
import type { ContactBlocks, PageResponse, SiteSettings } from '@/lib/types';
import { Logo, useNavItems } from './Header';
import { InstagramIcon } from './Icon';

export function tgHref(v?: string) {
  if (!v) return undefined;
  if (v.startsWith('http')) return v;
  return 'https://t.me/' + v.replace(/^@/, '');
}
export function igHref(v?: string) {
  if (!v) return undefined;
  if (v.startsWith('http')) return v;
  return 'https://instagram.com/' + v.replace(/^@/, '');
}
export function handle(v?: string) {
  if (!v) return '';
  return '@' + v.replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me|instagram\.com)\//, '').replace(/^@/, '').replace(/\/$/, '');
}

export function Footer() {
  const { t, to, lang } = useI18n();
  const items = useNavItems();
  const { data: s } = useQuery<SiteSettings>('/public/settings');
  const { data: c } = useQuery<PageResponse<ContactBlocks>>('/public/pages/contact', { lang });
  const cb = c?.blocks;
  const phones = cb?.phones?.length ? cb.phones : s?.phone ? [s.phone] : [];
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-cta">
          <p className="footer-cta__text serif"><Em text={t.footerCta} /></p>
          <Link className="btn btn--gold btn--lg" to={to('/qabul') + '#ariza'}>{t.apply}<ArrowUpRight aria-hidden="true" /></Link>
        </div>
        <div className="footer-grid">
          <div className="footer-brand">
            <Logo light />
            <p>{t.footerAbout}</p>
            <div className="footer-social">
              {(cb?.telegram || s?.telegram) && <a href={tgHref(cb?.telegram || s?.telegram)} target="_blank" rel="noopener" aria-label="Telegram" className="icon-btn icon-btn--dark"><Send aria-hidden="true" /></a>}
              {(cb?.instagram || s?.instagram) && <a href={igHref(cb?.instagram || s?.instagram)} target="_blank" rel="noopener" aria-label="Instagram" className="icon-btn icon-btn--dark"><InstagramIcon /></a>}
            </div>
          </div>
          <nav aria-label={t.footerNav}>
            <h2 className="footer-h">{t.footerNav}</h2>
            <ul className="footer-links">
              {items.map((it) => <li key={it.path}><Link to={to(it.path)}>{it.label}</Link></li>)}
              <li><Link to={to('/maxfiylik')}>{t.navPrivacy}</Link></li>
            </ul>
          </nav>
          <div>
            <h2 className="footer-h">{t.footerContact}</h2>
            <ul className="footer-contacts">
              {(cb?.address || s?.address) && <li><MapPin aria-hidden="true" /><span>{cb?.address || s?.address}</span></li>}
              {phones.map((p) => <li key={p}><Phone aria-hidden="true" /><a href={telHref(p)}>{prettyPhone(p)}</a></li>)}
              {cb?.hours && <li><Clock aria-hidden="true" /><span>{cb.hours}</span></li>}
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {year} Smart Start. {t.rights}</span>
          <span>{t.city}</span>
          <a href="/admin" className="footer-staff">{t.staff}</a>
        </div>
      </div>
    </footer>
  );
}
