import { Suspense, useEffect, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import { I18nProvider, langFromSearch, localePath, storedLang, useI18n } from '@/lib/i18n';
import { captureUtm } from '@/lib/hooks';
import { useQuery } from '@/lib/query';
import type { SiteSettings } from '@/lib/types';
import { injectAnalytics, trackPage } from '@/lib/analytics';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ToastProvider } from '@/components/Feedback';
import { Pages } from '@/routes';
import Home from '@/pages/Home';
import NotFound from '@/pages/NotFound';

export default function App() {
  return (
    <BrowserRouter>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig reducedMotion="user">
          <Root />
        </MotionConfig>
      </LazyMotion>
    </BrowserRouter>
  );
}

function Root() {
  const loc = useLocation();
  if (loc.pathname === '/admin' || loc.pathname.startsWith('/admin/')) {
    return (
      <Suspense fallback={<div className="boot"><span className="spinner" /></div>}>
        <Pages.Admin />
      </Suspense>
    );
  }
  return (
    <I18nProvider>
      <ToastProvider>
        <PublicLayout />
      </ToastProvider>
    </I18nProvider>
  );
}

const PATHS: [string, React.ComponentType][] = [
  ['/', Home],
  ['/natijalar', Pages.Results],
  ['/oqituvchilar', Pages.Teachers],
  ['/qabul', Pages.Admission],
  ['/yangiliklar', Pages.News],
  ['/yangiliklar/:slug', Pages.Article],
  ['/galereya', Pages.Gallery],
  ['/aloqa', Pages.Contact],
  ['/rahmat', Pages.Thanks],
  ['/maxfiylik', Pages.Privacy],
];

function PublicLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const { t, rest } = useI18n();
  const prevRest = useRef(rest);
  const { data: settings } = useQuery<SiteSettings>('/public/settings');

  // remember the visitor's language: a URL without ?lang= + a stored ru/en choice → switch to it
  useLayoutEffect(() => {
    captureUtm();
    const s = storedLang();
    if (!new URLSearchParams(loc.search).has('lang') && s && s !== 'uz') {
      nav(localePath(s, loc.pathname + loc.search) + loc.hash, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (settings) injectAnalytics(settings); }, [settings]);
  useEffect(() => { trackPage(loc.pathname + loc.search); }, [loc.pathname, loc.search]);

  const onSwap = () => {
    const sameRoute = prevRest.current === rest; // language switch keeps the scroll position
    prevRest.current = rest;
    if (loc.hash) {
      requestAnimationFrame(() => document.getElementById(decodeURIComponent(loc.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } else if (!sameRoute) window.scrollTo(0, 0);
  };
  // hash links on the same page
  useEffect(() => {
    if (!loc.hash) return;
    const id = setTimeout(() => document.getElementById(decodeURIComponent(loc.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => clearTimeout(id);
  }, [loc.hash, loc.key]);

  const lang = langFromSearch(loc.search);
  return (
    <>
      <a className="skip-link" href="#main">{t.skip}</a>
      <Header />
      <AnimatePresence mode="wait" initial={false} onExitComplete={onSwap}>
        <m.main
          id="main"
          key={rest + lang}
          className="site-main"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}
          tabIndex={-1}
        >
          <Suspense fallback={<div className="page-loading"><span className="spinner" aria-label={t.loading} /></div>}>
            <Routes location={loc}>
              {PATHS.map(([p, C]) => <Route key={p} path={p} element={<C />} />)}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </m.main>
      </AnimatePresence>
      <Footer />
    </>
  );
}
