import { useI18n } from '@/lib/i18n';
import { useSeo } from '@/lib/seo';
import { MapEmbed, PageHero } from '@/components/Blocks';
import { ContactForm } from '@/components/Forms';
import { PageLoading } from '@/components/Feedback';
import { ContactCards, useContact } from '@/components/sections';
import '@/styles/pages.css';

export default function Contact() {
  const { t } = useI18n();
  const c = useContact();
  useSeo({ title: c.seo?.title || t.navContact, description: c.seo?.description || t.contactLead });
  if (c.loading) return <PageLoading />;
  return (
    <>
      <PageHero eyebrow={t.contactEyebrow} title={c.title ?? t.contactPageTitle} lead={c.text || t.contactLead} />
      <section className="section section--top0">
        <div className="container contact-page">
          <ContactCards />
          <div className="form-card">
            <div className="form-card__head">
              <h2 className="h3">{t.writeUs}</h2>
            </div>
            <ContactForm />
          </div>
        </div>
        <div className="container" style={{ marginTop: 32 }}>
          <MapEmbed url={c.map} lat={c.lat} lng={c.lng} address={c.address} />
        </div>
      </section>
    </>
  );
}
