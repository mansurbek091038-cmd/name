import { lazy } from 'react';

/** Route chunk loaders — exposed so links can warm them up on hover/focus. */
export const loaders = {
  results: () => import('./pages/Results'),
  teachers: () => import('./pages/Teachers'),
  admission: () => import('./pages/Admission'),
  news: () => import('./pages/News'),
  article: () => import('./pages/Article'),
  gallery: () => import('./pages/Gallery'),
  contact: () => import('./pages/Contact'),
  thanks: () => import('./pages/Thanks'),
  privacy: () => import('./pages/Privacy'),
  admin: () => import('./admin/AdminApp'),
};

export const Pages = {
  Results: lazy(loaders.results),
  Teachers: lazy(loaders.teachers),
  Admission: lazy(loaders.admission),
  News: lazy(loaders.news),
  Article: lazy(loaders.article),
  Gallery: lazy(loaders.gallery),
  Contact: lazy(loaders.contact),
  Thanks: lazy(loaders.thanks),
  Privacy: lazy(loaders.privacy),
  Admin: lazy(loaders.admin),
};

const byPath: Record<string, () => Promise<unknown>> = {
  '/natijalar': loaders.results,
  '/oqituvchilar': loaders.teachers,
  '/qabul': loaders.admission,
  '/yangiliklar': loaders.news,
  '/galereya': loaders.gallery,
  '/aloqa': loaders.contact,
  '/maxfiylik': loaders.privacy,
};
export function warm(path: string) {
  const base = '/' + (path.split(/[/?#]/)[1] ?? '');
  byPath[base]?.().catch(() => undefined);
}
