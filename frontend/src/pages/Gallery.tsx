import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { m } from 'motion/react';
import { ArrowLeft, Images } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { useSeo } from '@/lib/seo';
import { img } from '@/lib/format';
import type { Album, AlbumDetail } from '@/lib/types';
import { Img, Lightbox, PageHero } from '@/components/Blocks';
import { Empty, ErrorNotice, Skel } from '@/components/Feedback';
import { fadeUp, stagger } from '@/components/Motion';
import '@/styles/pages.css';

export default function Gallery() {
  const { t, lang } = useI18n();
  const [sp, setSp] = useSearchParams();
  const albumId = sp.get('album');
  const albums = useQuery<Album[] | { items: Album[] }>('/public/albums', { lang });
  const list = Array.isArray(albums.data) ? albums.data : albums.data?.items ?? [];
  const album = useQuery<AlbumDetail>(albumId ? `/public/albums/${albumId}` : null, { lang });
  const [lb, setLb] = useState<number | null>(null);
  useSeo({ title: album.data?.title || t.navGallery, description: t.galleryLead, image: img(list[0]?.cover, 'large') });

  const open = (id: number | null) => {
    const n = new URLSearchParams(sp);
    if (id) n.set('album', String(id)); else n.delete('album');
    setSp(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHero eyebrow={t.navGallery} title={t.galleryTitle} lead={album.data?.title ?? t.galleryLead} image={list[0]?.cover} />
      <section className="section section--top0">
        <div className="container">
          {!albumId ? (
            albums.error ? <ErrorNotice error={albums.error} onRetry={albums.reload} /> : !albums.loading && !list.length ? <Empty title={t.emptyTitle} /> : (
              <m.div className="albums" variants={stagger(0.08)} initial="hidden" animate="show">
                {albums.loading && [0, 1, 2].map((i) => <Skel key={i} h={360} r={26} />)}
                {list.map((a) => (
                  <m.button key={a.id} type="button" className="album" variants={fadeUp} onClick={() => open(a.id)}>
                    <span className="album__stack" aria-hidden="true"><i /><i /></span>
                    <span className="album__cover"><Img src={a.cover} alt="" sizes="(max-width: 700px) 92vw, 420px" /></span>
                    <span className="album__body">
                      <b className="serif">{a.title}</b>
                      <small><Images aria-hidden="true" />{a.count ?? 0} {t.photos}</small>
                    </span>
                  </m.button>
                ))}
              </m.div>
            )
          ) : (
            <>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => open(null)} style={{ marginBottom: 24 }}><ArrowLeft aria-hidden="true" />{t.backToAlbums}</button>
              {album.error ? <ErrorNotice error={album.error} onRetry={album.reload} /> : (
                <m.div className="masonry" variants={stagger(0.04)} initial="hidden" animate="show" key={albumId}>
                  {album.loading && [260, 340, 220, 300, 260, 320].map((h, i) => <Skel key={i} h={h} r={20} style={{ marginBottom: 16 }} />)}
                  {(album.data?.items ?? []).map((it, i) => (
                    <m.button key={it.id} type="button" className="masonry__item" variants={fadeUp} onClick={() => setLb(i)} aria-label={it.alt || `${i + 1}`}>
                      <img src={img(it, 'medium')} alt={it.alt ?? ''} loading="lazy" decoding="async" width={it.width ?? undefined} height={it.height ?? undefined} />
                    </m.button>
                  ))}
                </m.div>
              )}
            </>
          )}
        </div>
      </section>
      <Lightbox items={album.data?.items ?? []} index={lb} onClose={() => setLb(null)} onIndex={setLb} />
    </>
  );
}
