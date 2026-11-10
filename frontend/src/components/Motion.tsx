import { m, useReducedMotion, animate, useInView, type Variants } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode, type ElementType } from 'react';

const EASE = [0.22, 0.8, 0.24, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};
export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

type Tag = 'div' | 'section' | 'ul' | 'li' | 'article' | 'header' | 'span' | 'ol' | 'p' | 'h1' | 'h2' | 'h3';

/** Scroll-reveal wrapper. Children using `<RevealItem>` animate in with stagger. */
export function Reveal({ children, as = 'div', className, gap = 0.08, delay = 0, amount = 0.2, id, style, instant }: {
  children: ReactNode; as?: Tag; className?: string; gap?: number; delay?: number; amount?: number; id?: string; style?: React.CSSProperties; instant?: boolean;
}) {
  const M = m[as] as ElementType;
  return (
    <M id={id} className={className} style={style} variants={stagger(gap, delay)} initial={instant ? false : 'hidden'} whileInView="show" viewport={{ once: true, amount, margin: '0px 0px -8% 0px' }}>
      {children}
    </M>
  );
}
export function RevealItem({ children, as = 'div', className, variants = fadeUp, style }: {
  children: ReactNode; as?: Tag; className?: string; variants?: Variants; style?: React.CSSProperties;
}) {
  const M = m[as] as ElementType;
  return <M className={className} variants={variants} style={style}>{children}</M>;
}

/** Number that counts up once it scrolls into view. */
export function Counter({ value, duration = 1.6, className }: { value: number | string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const reduce = useReducedMotion();
  const target = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.]/g, ''));
  const isNum = !isNaN(target) && String(value).trim() !== '';
  const decimals = isNum && String(value).includes('.') ? String(value).split('.')[1].length : 0;
  const isYear = isNum && target >= 1900 && target <= 2100 && decimals === 0;
  const [shown, setShown] = useState<string>(() => (!isNum || isYear || reduce ? String(value) : (0).toFixed(decimals)));

  useEffect(() => {
    if (!isNum || isYear || reduce) { setShown(String(value)); return; }
    if (!inView) return;
    const c = animate(0, target, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setShown(v.toFixed(decimals)) });
    return () => c.stop();
  }, [inView, target, isNum, isYear, reduce, duration, decimals, value]);

  return <span ref={ref} className={className}><span className="sr-only">{String(value)}</span><span aria-hidden="true">{shown}</span></span>;
}
