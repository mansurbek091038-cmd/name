import { useState, useRef } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Check, Clock, GraduationCap, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useQuery } from '@/lib/query';
import { isPhoneComplete, normalizePhone } from '@/lib/format';
import { useDialog, useLockBody } from '@/lib/hooks';
import type { Course } from '@/lib/types';
import { ErrorNotice, Notice, Skel } from './Feedback';
import { Field, PhoneInput } from './Forms';
import { Img } from './Blocks';

export function CourseEnrollModal({ course, onClose }: { course: Course; onClose: () => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useLockBody(true);
  useDialog(true, onClose, ref);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eMap: Record<string, string> = {};
    if (!name.trim()) eMap.name = t.required;
    if (!isPhoneComplete(phone)) eMap.phone = t.invalidPhone;
    setErrs(eMap);
    if (Object.keys(eMap).length) return;

    setBusy(true);
    setServerErr(null);
    try {
      const res = await api.post<{ message?: string }>(`/public/courses/${course.id}/enroll`, {
        name: name.trim(),
        phone: normalizePhone(phone),
        comment: comment.trim() || undefined,
      });
      setDone(res?.message || t.enrollSuccess);
    } catch (err) {
      setServerErr((err as Error).message || t.errServer);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" role="presentation">
      <m.div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-dialog-title"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.2 }}
        style={{ padding: '36px 32px' }}
      >
        <button
          type="button"
          className="dialog__close"
          onClick={onClose}
          aria-label={t.close}
        >
          <X aria-hidden="true" />
        </button>

        {done ? (
          <div className="tour-done" role="status" style={{ marginTop: 0 }}>
            <span className="icon-tile icon-tile--gold"><Check aria-hidden="true" /></span>
            <div>
              <b className="serif">{t.enrollSuccess}</b>
              <p>{done}</p>
              <button
                type="button"
                className="btn btn--ink btn--sm"
                onClick={onClose}
                style={{ marginTop: 14 }}
              >
                {t.close}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <div style={{ marginBottom: 20 }}>
              <span className="eyebrow" style={{ color: 'var(--gold-ink)' }}>{t.enrollCourse}</span>
              <h2 id="course-dialog-title" className="h3 serif" style={{ marginTop: 4 }}>
                {course.title}
              </h2>
              {course.duration && (
                <span className="tag tag--soft" style={{ marginTop: 8 }}>
                  <Clock aria-hidden="true" style={{ width: 14, height: 14, marginRight: 4 }} />
                  {course.duration}
                </span>
              )}
            </div>

            {serverErr && (
              <div className="notice notice--error" style={{ marginBottom: 16 }}>
                {serverErr}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field id="enroll-name" label={t.parentName} error={errs.name}>
                {(id, d) => (
                  <input
                    id={id}
                    className="input"
                    autoComplete="name"
                    placeholder={t.parentNamePh}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-invalid={!!errs.name || undefined}
                    aria-describedby={d}
                  />
                )}
              </Field>

              <Field id="enroll-phone" label={t.phoneLabel} error={errs.phone}>
                {(id, d) => (
                  <PhoneInput
                    id={id}
                    value={phone}
                    onChange={setPhone}
                    invalid={!!errs.phone}
                    describedBy={d}
                  />
                )}
              </Field>

              <Field id="enroll-comment" label={t.comment} error={errs.comment}>
                {(id, d) => (
                  <textarea
                    id={id}
                    className="textarea"
                    rows={3}
                    placeholder={t.commentPh}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    aria-describedby={d}
                  />
                )}
              </Field>

              <p className="form__consent" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                {t.consent}
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn--ghost" onClick={onClose} disabled={busy}>
                  {t.close}
                </button>
                <button type="submit" className="btn btn--gold" disabled={busy}>
                  <GraduationCap aria-hidden="true" />
                  {busy ? t.sending : t.send}
                </button>
              </div>
            </div>
          </form>
        )}
      </m.div>
    </div>
  );
}

export function CourseCard({ course, onEnroll }: { course: Course; onEnroll: (c: Course) => void }) {
  const { t } = useI18n();
  const priceDisplay = course.price
    ? `${course.price.toLocaleString('uz-UZ')} ${t.sum}`
    : course.price_text || null;

  return (
    <article className="course-card">
      <div className="course-card__media">
        {course.image ? (
          <Img src={course.image} alt={course.title} sizes="(max-width: 900px) 100vw, 420px" />
        ) : (
          <div className="course-card__placeholder">
            <GraduationCap aria-hidden="true" />
          </div>
        )}
        {course.duration && (
          <span className="course-card__badge">
            <Clock aria-hidden="true" />
            {course.duration}
          </span>
        )}
      </div>
      <div className="course-card__body">
        <h3 className="course-card__title serif">{course.title}</h3>
        {course.description && <p className="course-card__desc">{course.description}</p>}
        <div className="course-card__foot">
          {priceDisplay && (
            <div className="course-card__price">
              <span className="course-card__price-lbl">{t.coursePrice}</span>
              <span className="course-card__price-val">{priceDisplay}</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn--gold btn--sm"
            onClick={() => onEnroll(course)}
          >
            <GraduationCap aria-hidden="true" />
            {t.enrollCourse}
          </button>
        </div>
      </div>
    </article>
  );
}

export function Courses({ limit }: { limit?: number } = {}) {
  const { t, lang } = useI18n();
  const { data, error, loading, reload } = useQuery<Course[]>('/public/courses', { lang });
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  const courses = (Array.isArray(data) ? data : []).slice(0, limit ?? 99);

  if (error) return <ErrorNotice error={error} onRetry={reload} />;
  if (loading) {
    return (
      <div className="courses-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="course-card">
            <Skel h={200} />
            <div style={{ padding: 20 }}>
              <Skel h={24} w="80%" />
              <Skel h={16} w="100%" style={{ marginTop: 12 }} />
              <Skel h={16} w="60%" style={{ marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!courses.length) {
    return <Notice>{t.noCourses}</Notice>;
  }

  return (
    <>
      <div className="courses-grid">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            onEnroll={setSelectedCourse}
          />
        ))}
      </div>

      <AnimatePresence>
        {selectedCourse && (
          <CourseEnrollModal
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
