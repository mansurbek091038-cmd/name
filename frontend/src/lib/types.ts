export type Lang = 'uz' | 'ru' | 'en';
export const LANGS: Lang[] = ['uz', 'ru', 'en'];

export interface Media {
  id: number;
  url: string;
  thumb?: string | null;
  medium?: string | null;
  large?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

/** Image fields may come as a media object or a plain url string. */
export type ImageRef = Media | string | null | undefined;

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Seo { title?: string; description?: string; og_image?: string | null }

export interface HomeBlocks {
  hero?: {
    badge?: string; admission_open?: string; questions?: string; photo_caption?: string; title?: string; title_accent?: string; text?: string; motto?: string;
    cta_primary?: string; cta_secondary?: string; image?: ImageRef;
  };
  stats?: { value: number | string; suffix?: string; label: string }[];
  why?: { icon?: string; title: string; text: string }[];
  cta?: { title?: string; text?: string; button?: string };
  stages?: { key?: string; badge?: string; title: string; ages?: string; grades?: string; text?: string; points?: string[]; image?: ImageRef }[];
  day?: { time: string; title: string; text?: string }[];
  [k: string]: unknown;
}
export interface AdmissionBlocks { steps?: { title: string; text?: string }[]; documents?: string[]; [k: string]: unknown }
export interface ContactBlocks {
  address?: string; phones?: string[]; telegram?: string; instagram?: string; hours?: string;
  map_embed_url?: string; lat?: number; lng?: number; [k: string]: unknown;
}
export interface PageResponse<B = Record<string, unknown>> { key: string; blocks: B; seo?: Seo }

export interface Post {
  id: number; type: 'news' | 'event' | string; slug: string; title: string; excerpt?: string;
  cover?: ImageRef; event_date?: string | null; published_at?: string | null; body?: string; seo?: Seo;
}
export interface Teacher { id: number; full_name: string; subject?: string; experience_years?: number | null; bio?: string; photo?: ImageRef; badge?: string | null }
export interface Price { id: number; grade_range: string; monthly_fee?: number | null; meals_fee?: number | null; transport_fee?: number | null; note?: string | null }
export interface Faq { id: number; question: string; answer: string }
export interface Testimonial {
  id: number;
  author: string;
  child_name?: string | null;
  child_grade?: string | number | null;
  photo?: ImageRef;
  photo_id?: number | null;
  date?: string | null;
  text: string;
  is_visible?: boolean;
}

export interface Course {
  id: number;
  title: string;
  title_uz?: string;
  title_ru?: string;
  title_en?: string;
  description: string;
  description_uz?: string;
  description_ru?: string;
  description_en?: string;
  image?: ImageRef;
  image_id?: number | null;
  duration: string;
  price?: number | null;
  price_text?: string;
  order?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface CourseEnrollment {
  id: number;
  course_id?: number | null;
  course_title?: string;
  course_name?: string;
  name: string;
  phone: string;
  comment?: string;
  is_handled?: boolean;
  handled?: boolean;
  status?: string;
  ip?: string;
  created_at: string;
}

export type CertType = 'IELTS' | 'CEFR' | 'SAT' | 'olimpiada' | 'boshqa' | string;
export interface SubScores { listening?: string | number | null; reading?: string | number | null; writing?: string | number | null; speaking?: string | number | null; math?: string | number | null; ebrw?: string | number | null }
export interface Certificate {
  id: number; type: CertType; score: string | number; sub_scores?: SubScores | null;
  student_name: string; grade?: number | string | null; year?: number | null; date?: string | null;
  subject?: string | null; level?: string | null; teacher?: string | null; cert_number_masked?: string | null;
  image?: ImageRef; verify_url?: string | null; is_featured?: boolean; is_new?: boolean;
}
export interface CertStats { ielts_7_plus: number; cefr_b2_c1: number; olympiad_winners: number; sat_1300_plus: number; total: number }

export interface Partner {
  id: number; name: string; country?: string; country_code?: string; logo?: ImageRef; qs_rank?: number | string | null;
  qs_year?: number | null; description?: string; website_url?: string | null; lat?: number | null; lng?: number | null;
}
export interface Album { id: number; title: string; cover?: ImageRef; count?: number }
export interface AlbumDetail { id: number; title: string; items: Media[] }
export interface Tour { id: number; date: string; time?: string; type: 'ekskursiya' | 'ochiq_eshiklar' | string; capacity: number; booked: number; free: number }

export interface SiteSettings {
  site_name?: string; phone?: string; telegram?: string; instagram?: string; address?: string;
  work_hours_weekday?: string; work_hours_saturday?: string; working_hours?: string;
  turnstile_site_key?: string | null; ga4_id?: string | null; ym_id?: string | null; meta_pixel_id?: string | null;
}

/* ---------- admin ---------- */
export type Role = 'super_admin' | 'admin' | 'manager';
export interface User { id: number; email: string; full_name: string; role: Role; is_active: boolean; two_fa_enabled: boolean; created_at?: string }
export type AdmissionStatus = 'new' | 'contacted' | 'tour_scheduled' | 'interview' | 'contract' | 'rejected';
export interface Admission {
  id: number; number: string; parent_name: string; phone: string; child_name: string; birth_year?: number | null;
  target_grade?: string | number | null; comment?: string | null; status: AdmissionStatus;
  assigned_to?: { id: number; full_name: string } | null; next_call_at?: string | null;
  utm_source?: string | null; utm_campaign?: string | null; source?: string | null; created_at: string; notes_count?: number;
}
export interface AdmissionNote { id: number; author?: { id: number; full_name: string } | null; text: string; created_at: string }
export interface HistoryItem { id?: number; action?: string; user?: { id: number; full_name: string } | string | null; created_at?: string; changes?: unknown; diff?: unknown; [k: string]: unknown }
export interface AdmissionDetail extends Admission { notes?: AdmissionNote[]; history?: HistoryItem[] }
export interface Dashboard {
  totals: { admissions: number; new_today: number; this_month: number; conversion_rate: number; tours_upcoming: number; bookings_upcoming: number };
  by_status: { status: string; count: number }[];
  by_source: { source: string | null; count: number }[];
  by_day: { date: string; count: number }[];
  by_grade: { grade: string | number | null; count: number }[];
  recent: Admission[];
}
