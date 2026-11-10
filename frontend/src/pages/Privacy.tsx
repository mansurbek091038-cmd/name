import { accentLast, useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import type { PageResponse } from '@/lib/types';
import { PageHero } from '@/components/Blocks';
import { ErrorNotice, PageLoading, Skel } from '@/components/Feedback';
import '@/styles/pages.css';

type Sec = { title?: string; text?: string; body?: string; items?: string[] };
interface PrivacyBlocks { title?: string; intro?: string; body?: string; html?: string; updated?: string; sections?: Sec[]; [k: string]: unknown }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const paras = (s: string) => /<\w+/.test(s) ? s : s.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

export default function Privacy() {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useQuery<PageResponse<PrivacyBlocks>>('/public/pages/privacy', { lang });
  const b = data?.blocks ?? {};
  useSeo({ title: data?.seo?.title || t.navPrivacy, description: data?.seo?.description });

  let html = '';
  if (b.intro) html += paras(b.intro);
  if (b.body || b.html) html += paras(String(b.body ?? b.html));
  for (const s of b.sections ?? []) {
    if (s.title) html += `<h2>${esc(s.title)}</h2>`;
    if (s.text || s.body) html += paras(String(s.text ?? s.body));
    if (s.items?.length) html += `<ul>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`;
  }
  if (!html) {
    // unknown structure: render any string values in order
    for (const [k, v] of Object.entries(b)) if (typeof v === 'string' && k !== 'title') html += paras(v);
  }

  if (loading && !data) return <PageLoading />;
  return (
    <>
      <PageHero eyebrow={t.navPrivacy} title={accentLast(b.title, lang) ?? t.privacyTitle} lead={b.updated ? String(b.updated) : undefined} />
      <section className="section section--top0">
        <div className="container container--narrow">
          {error ? <ErrorNotice error={error} onRetry={reload} /> : loading ? <><Skel h={20} /><Skel h={20} style={{ marginTop: 10 }} /><Skel h={20} w="70%" style={{ marginTop: 10 }} /></> : (
            <div className="prose card card--pad" dangerouslySetInnerHTML={{ __html: html }} />
          )}
        </div>
      </section>
    </>
  );
}
