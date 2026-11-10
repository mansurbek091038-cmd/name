import { Link } from 'react-router';
import { GraduationCap } from 'lucide-react';
import { Em, useI18n } from '@/lib/i18n';
import { useSeo } from '@/lib/seo';
import { PageHero } from '@/components/Blocks';
import { TeachersGrid, Testimonials } from '@/components/sections';
import '@/styles/pages.css';

export default function Teachers() {
  const { t, to } = useI18n();
  useSeo({ title: t.navTeachers, description: t.teachersLead });
  return (
    <>
      <PageHero eyebrow={t.teachersEyebrow} title={t.teachersPageTitle} lead={t.teachersLead} />
      <section className="section section--top0">
        <div className="container"><TeachersGrid showBio /></div>
      </section>
      <Testimonials />
      <section className="section section--tight">
        <div className="container">
          <div className="strip-cta">
            <p className="serif"><Em text={t.footerCta} /></p>
            <Link to={to('/qabul') + '#ariza'} className="btn btn--gold btn--lg"><GraduationCap aria-hidden="true" />{t.apply}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
