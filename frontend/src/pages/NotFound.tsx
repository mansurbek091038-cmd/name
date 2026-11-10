import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useSeo } from '@/lib/seo';

export default function NotFound() {
  const { t, to } = useI18n();
  useSeo({ title: t.notFoundTitle, noindex: true });
  return (
    <section className="section notfound">
      <div className="container">
        <div className="notfound__num serif" aria-hidden="true">4<span>0</span>4</div>
        <h1 className="h2">{t.notFoundTitle}</h1>
        <p className="lead">{t.notFoundText}</p>
        <Link to={to('/')} className="btn btn--ink btn--lg"><ArrowLeft aria-hidden="true" />{t.backHome}</Link>
      </div>
    </section>
  );
}
