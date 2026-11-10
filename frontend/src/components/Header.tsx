import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import { GraduationCap, Menu, Moon, Phone, Sun, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useDialog, useLockBody, useTheme } from '@/lib/hooks';
import { useQuery } from '@/lib/query';
import { prettyPhone, telHref } from '@/lib/format';
import { LANGS, type SiteSettings } from '@/lib/types';
import { warm } from '@/routes';

export function useNavItems() {
  const { t } = useI18n();
  return [
    { path: '/', label: t.navHome },
    { path: '/natijalar', label: t.navResults },
    { path: '/oqituvchilar', label: t.navTeachers },
    { path: '/qabul', label: t.navAdmission },
    { path: '/yangiliklar', label: t.navNews },
    { path: '/galereya', label: t.navGallery },
    { path: '/aloqa', label: t.navContact },
  ];
}

export function Logo({ light }: { light?: boolean }) {
  const { t, to } = useI18n();
  return (
    <Link to={to('/')} className={`logo${light ? ' logo--light' : ''}`} title={t.navHome}>
      <img src="/brand/logo-96.webp" srcSet="/brand/logo-96.webp 1x, /brand/logo-192.webp 2x" width="46" height="46" alt="" />
      <span><b>{t.schoolName}</b><small>{t.schoolSub}</small></span>
    </Link>
  );
}

export function LangSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`seg ${className}`} role="group" aria-label={t.language}>
      {LANGS.map((l) => (
        <button key={l} type="button" aria-pressed={l === lang} lang={l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useTheme();
  const dark = theme === 'dark';
  return (
    <button type="button" className="icon-btn" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? t.themeLight : t.themeDark} title={dark ? t.themeLight : t.themeDark}>
      {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </button>
  );
}

export function Header() {
  const { t, to } = useI18n();
  const items = useNavItems();
  const loc = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const { data: settings } = useQuery<SiteSettings>('/public/settings');
  useLockBody(open);
  useDialog(open, () => setOpen(false), sheet);

  useEffect(() => {
    const on = () => setScrolled((s) => (s !== window.scrollY > 8 ? !s : s));
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="container site-header__in">
        <Logo />
        <nav className="main-nav" aria-label={t.menu}>
          {items.map((it) => (
            <NavLink key={it.path} to={to(it.path)} end={it.path === '/'} onMouseEnter={() => warm(it.path)} onFocus={() => warm(it.path)}>
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="site-header__tools">
          <LangSwitch className="hide-sm" />
          <ThemeToggle />
          <Link to={to('/qabul') + '#ariza'} className="btn btn--ink btn--sm header-cta" onMouseEnter={() => warm('/qabul')}>
            <GraduationCap aria-hidden="true" /><span>{t.apply}</span>
          </Link>
          <button type="button" className="icon-btn burger" aria-label={t.menu} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(true)}>
            <Menu aria-hidden="true" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <m.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <m.div
              ref={sheet}
              id="mobile-menu"
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-label={t.menu}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sheet__top">
                <Logo />
                <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label={t.closeMenu}><X aria-hidden="true" /></button>
              </div>
              <nav className="sheet__nav" aria-label={t.menu}>
                {items.map((it, i) => (
                  <m.div key={it.path} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.04 }}>
                    <NavLink to={to(it.path)} end={it.path === '/'}>{it.label}</NavLink>
                  </m.div>
                ))}
              </nav>
              <div className="sheet__foot">
                <LangSwitch />
                <Link to={to('/qabul') + '#ariza'} className="btn btn--gold btn--block"><GraduationCap aria-hidden="true" />{t.apply}</Link>
                {settings?.phone && (
                  <a className="btn btn--ghost btn--block" href={telHref(settings.phone)}><Phone aria-hidden="true" />{prettyPhone(settings.phone)}</a>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
