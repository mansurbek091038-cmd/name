import { useEffect } from 'react';
import { localePath, useI18n } from './i18n';
import { LANGS, type ImageRef } from './types';
import { img } from './format';

function setMeta(attr: 'name' | 'property', key: string, content?: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) { el?.remove(); return; }
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = content;
}
function setLink(rel: string, href: string, hreflang?: string) {
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector<HTMLLinkElement>(sel);
  if (!el) { el = document.createElement('link'); el.rel = rel; if (hreflang) el.hreflang = hreflang; document.head.appendChild(el); }
  el.href = href;
}

/** Sets title/description/OG + canonical and hreflang alternates for the current route. */
export function useSeo(p: { title?: string; description?: string; image?: ImageRef; noindex?: boolean }) {
  const { lang, rest } = useI18n();
  const image = img(p.image, 'large') ?? null;
  useEffect(() => {
    const site = 'Smart Start';
    const title = p.title ? (p.title.includes(site) ? p.title : `${p.title} — ${site}`) : site;
    document.title = title;
    setMeta('name', 'description', p.description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', p.description);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:locale', lang === 'uz' ? 'uz_UZ' : lang === 'ru' ? 'ru_RU' : 'en_US');
    const origin = location.origin;
    setMeta('property', 'og:image', image ? (image.startsWith('http') ? image : origin + image) : origin + '/brand/logo-384.webp');
    setMeta('property', 'og:url', origin + localePath(lang, rest));
    setMeta('name', 'robots', p.noindex ? 'noindex,nofollow' : null);
    setLink('canonical', origin + localePath(lang, rest));
    for (const l of LANGS) setLink('alternate', origin + localePath(l, rest), l);
    setLink('alternate', origin + localePath('uz', rest), 'x-default');
  }, [p.title, p.description, image, p.noindex, lang, rest]);
}
