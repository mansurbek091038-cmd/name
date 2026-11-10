import {
  Users, Languages, Sun, MessageCircle, ShieldCheck, Award, BookOpen, GraduationCap, Clock, Utensils, Bus, Heart,
  Sparkles, Trophy, Globe2, Brain, Calculator, Palette, Music, Dumbbell, Microscope, Laptop, Baby, Star, Home, Medal,
  Lightbulb, Target, Smile, Camera, Coffee, PenTool, School, type LucideIcon,
} from 'lucide-react';

const MAP: Record<string, LucideIcon> = {
  users: Users, people: Users, group: Users, class: Users, 'small-class': Users,
  languages: Languages, language: Languages, english: Languages, globe: Globe2, world: Globe2,
  sun: Sun, day: Sun, 'full-day': Sun, clock: Clock, time: Clock,
  'message-circle': MessageCircle, message: MessageCircle, chat: MessageCircle, communication: MessageCircle,
  'shield-check': ShieldCheck, shield: ShieldCheck, safe: ShieldCheck, safety: ShieldCheck,
  award: Award, certificate: Award, certificates: Award, medal: Medal, trophy: Trophy,
  'book-open': BookOpen, book: BookOpen, 'graduation-cap': GraduationCap, graduation: GraduationCap,
  utensils: Utensils, food: Utensils, meals: Utensils, bus: Bus, transport: Bus, heart: Heart, care: Heart,
  sparkles: Sparkles, brain: Brain, calculator: Calculator, math: Calculator, palette: Palette, art: Palette,
  music: Music, dumbbell: Dumbbell, sport: Dumbbell, microscope: Microscope, science: Microscope, laptop: Laptop,
  it: Laptop, baby: Baby, star: Star, home: Home, lightbulb: Lightbulb, idea: Lightbulb, target: Target,
  smile: Smile, camera: Camera, coffee: Coffee, pen: PenTool, school: School,
};

export function iconFor(name?: string, fallback: LucideIcon = Sparkles): LucideIcon {
  if (!name) return fallback;
  const k = name.toLowerCase().replace(/^lucide[-:]/, '').replace(/icon$/, '').trim();
  return MAP[k] ?? MAP[k.replace(/_/g, '-')] ?? fallback;
}

export function DynIcon({ name, size = 22, fallback }: { name?: string; size?: number; fallback?: LucideIcon }) {
  const I = iconFor(name, fallback);
  return <I width={size} height={size} aria-hidden="true" />;
}

/** Instagram glyph (brand icons were removed from lucide). */
export function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
