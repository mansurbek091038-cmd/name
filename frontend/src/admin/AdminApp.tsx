import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import { AnimatePresence, m } from 'motion/react';
import {
  Award, BookOpen, ClipboardList, Clock, ExternalLink, FileText, Globe2, GraduationCap, Images, Inbox, LayoutDashboard,
  LogOut, Menu, MessageSquareQuote, Moon, ScrollText, Settings, Sun, Tag, UserCircle2, Users, UsersRound, HelpCircle, X,
} from 'lucide-react';
import '@/styles/admin.css';
import { I18nProvider } from '@/lib/i18n';
import { useTheme } from '@/lib/hooks';
import type { Role } from '@/lib/types';
import { ToastProvider } from '@/components/Feedback';
import { AuthProvider, hasRole, ROLE_LABEL, useAuth } from './auth';
import { ConfirmProvider, Loading } from './ui';
import Login from './Login';

const Dashboard = lazy(() => import('./Dashboard'));
const Admissions = lazy(() => import('./Admissions'));
const ResourcePage = lazy(() => import('./Resource'));
const PagesEditor = lazy(() => import('./PagesEditor'));
const Tours = lazy(() => import('./Tours'));
const Messages = lazy(() => import('./Messages'));
const UsersPage = lazy(() => import('./Users'));
const SettingsPage = lazy(() => import('./Settings'));
const Audit = lazy(() => import('./Audit'));
const Profile = lazy(() => import('./Profile'));
const CoursesAdmin = lazy(() => import('./CoursesAdmin'));
const WorkHours = lazy(() => import('./WorkHours'));

interface NavItem { to: string; label: string; icon: ReactNode; role: Role; end?: boolean }
export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Asosiy', items: [
      { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard />, role: 'admin', end: true },
      { to: '/admin/arizalar', label: 'Arizalar (CRM)', icon: <ClipboardList />, role: 'manager' },
      { to: '/admin/kurslar', label: 'Kurslar', icon: <GraduationCap />, role: 'manager' },
      { to: '/admin/fikrlar', label: 'Ota-onalar fikrlari', icon: <MessageSquareQuote />, role: 'manager' },
      { to: '/admin/xabarlar', label: 'Xabarlar', icon: <Inbox />, role: 'manager' },
    ],
  },
  {
    group: 'Kontent', items: [
      { to: '/admin/sahifalar', label: 'Sahifa bloklari', icon: <FileText />, role: 'manager' },
      { to: '/admin/kontent/posts', label: 'Yangiliklar', icon: <BookOpen />, role: 'manager' },
      { to: '/admin/kontent/certificates', label: 'Sertifikatlar', icon: <Award />, role: 'manager' },
      { to: '/admin/kontent/teachers', label: 'O‘qituvchilar', icon: <UsersRound />, role: 'manager' },
      { to: '/admin/kontent/partners', label: 'Hamkorlar', icon: <Globe2 />, role: 'manager' },
      { to: '/admin/kontent/albums', label: 'Galereya', icon: <Images />, role: 'manager' },
      { to: '/admin/kontent/prices', label: 'Narxlar', icon: <Tag />, role: 'manager' },
      { to: '/admin/kontent/faqs', label: 'FAQ', icon: <HelpCircle />, role: 'manager' },
    ],
  },
  {
    group: 'Tizim', items: [
      { to: '/admin/ish-vaqti', label: 'Ish vaqti', icon: <Clock />, role: 'admin' },
      { to: '/admin/foydalanuvchilar', label: 'Foydalanuvchilar', icon: <Users />, role: 'super_admin' },
      { to: '/admin/sozlamalar', label: 'Sozlamalar', icon: <Settings />, role: 'admin' },
      { to: '/admin/audit', label: 'Audit jurnali', icon: <ScrollText />, role: 'admin' },
      { to: '/admin/profil', label: 'Profil va 2FA', icon: <UserCircle2 />, role: 'manager' },
    ],
  },
];

export default function AdminApp() {
  useEffect(() => {
    document.title = 'Smart Start — Admin';
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    robots.content = 'noindex,nofollow';
  }, []);
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/admin/login" element={<Login />} />
              <Route path="/admin/*" element={<Guarded />} />
            </Routes>
          </ConfirmProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  );
}

function Guarded() {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="boot"><span className="spinner" /></div>;
  if (!user) return <Navigate to={`/admin/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Shell />;
}

function RoleRoute({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!hasRole(user, role)) return <div className="a-forbidden"><h1>Ruxsat yo‘q</h1><p>Bu bo‘lim sizning rolingiz uchun yopiq.</p><Link className="btn btn--ink btn--sm" to="/admin/arizalar">Arizalarga o‘tish</Link></div>;
  return <>{children}</>;
}

function Shell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  useEffect(() => setOpen(false), [loc.pathname]);
  const doLogout = async () => { await logout(); nav('/admin/login', { replace: true }); };

  const sidebar = (
    <>
      <div className="a-side__brand">
        <img src="/brand/logo-192.webp" alt="" width={40} height={40} />
        <div><b>Smart Start</b><small>Boshqaruv paneli</small></div>
      </div>
      <nav className="a-side__nav" aria-label="Admin menyu">
        {NAV.map((g) => {
          const items = g.items.filter((i) => hasRole(user, i.role));
          if (!items.length) return null;
          return (
            <div key={g.group} className="a-side__group">
              <span className="a-side__label">{g.group}</span>
              {items.map((i) => <NavLink key={i.to} to={i.to} end={i.end}>{i.icon}<span>{i.label}</span></NavLink>)}
            </div>
          );
        })}
      </nav>
      <div className="a-side__foot">
        <a href="/" target="_blank" rel="noopener" className="a-side__site"><ExternalLink />Saytni ochish</a>
      </div>
    </>
  );

  return (
    <div className="a-shell">
      <aside className="a-side">{sidebar}</aside>
      <AnimatePresence>
        {open && (
          <m.div className="a-side-mobile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <m.aside className="a-side" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 380, damping: 40 }} onClick={(e) => e.stopPropagation()}>
              <button type="button" className="icon-btn icon-btn--dark a-side__close" onClick={() => setOpen(false)} aria-label="Yopish"><X /></button>
              {sidebar}
            </m.aside>
          </m.div>
        )}
      </AnimatePresence>
      <div className="a-main">
        <header className="a-top">
          <button type="button" className="icon-btn a-top__burger" onClick={() => setOpen(true)} aria-label="Menyu"><Menu /></button>
          <div className="a-top__spacer" />
          <button type="button" className="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Mavzu">{theme === 'dark' ? <Sun /> : <Moon />}</button>
          <Link to="/admin/profil" className="a-user">
            <span className="a-user__av" aria-hidden="true">{user!.full_name.split(/\s+/).map((s) => s[0]).slice(0, 2).join('')}</span>
            <span className="a-user__txt"><b>{user!.full_name}</b><small>{ROLE_LABEL[user!.role]}</small></span>
          </Link>
          <button type="button" className="btn btn--ghost btn--sm" onClick={doLogout}><LogOut />Chiqish</button>
        </header>
        <main className="a-content">
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route index element={hasRole(user, 'admin') ? <Dashboard /> : <Navigate to="/admin/arizalar" replace />} />
              <Route path="arizalar" element={<Admissions />} />
              <Route path="kurslar" element={<CoursesAdmin />} />
              <Route path="fikrlar" element={<ResourcePage resource="testimonials" />} />
              <Route path="ish-vaqti" element={<RoleRoute role="admin"><WorkHours /></RoleRoute>} />
              <Route path="ekskursiyalar" element={<Tours />} />
              <Route path="xabarlar" element={<Messages />} />
              <Route path="sahifalar" element={<PagesEditor />} />
              <Route path="sahifalar/:key" element={<PagesEditor />} />
              <Route path="kontent/:resource" element={<ResourcePage />} />
              <Route path="foydalanuvchilar" element={<RoleRoute role="super_admin"><UsersPage /></RoleRoute>} />
              <Route path="sozlamalar" element={<RoleRoute role="admin"><SettingsPage /></RoleRoute>} />
              <Route path="audit" element={<RoleRoute role="admin"><Audit /></RoleRoute>} />
              <Route path="profil" element={<Profile />} />
              <Route path="*" element={<div className="a-forbidden"><h1>Topilmadi</h1><Link className="btn btn--ink btn--sm" to="/admin">Bosh panel</Link></div>} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  );
}
