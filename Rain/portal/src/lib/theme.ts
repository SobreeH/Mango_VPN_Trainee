export type UiLang = 'th' | 'en';

export interface ThemeClasses {
  card: string;
  subCard: string;
  input: string;
  tableHead: string;
  tableRow: string;
  divide: string;
  heading: string;
  text: string;
  muted: string;
  border: string;
  secondaryBtn: string;
  modal: string;
  pillMuted: string;
}

export function getThemeClasses(isDark: boolean): ThemeClasses {
  return {
    card: isDark
      ? 'border-white/5 bg-[#1e1d1a]/85 text-stone-100 shadow-2xl backdrop-blur-xl'
      : 'border-stone-200/90 bg-white/95 text-stone-900 shadow-lg shadow-stone-200/50 backdrop-blur-xl',
    subCard: isDark
      ? 'border-white/5 bg-[#141311]/80 text-stone-200'
      : 'border-stone-200 bg-stone-50/90 text-stone-800',
    input: isDark
      ? 'border-white/10 bg-[#262420]/70 text-stone-100 placeholder-stone-500 focus:border-emerald-400'
      : 'border-stone-300 bg-white text-stone-900 placeholder-stone-400 focus:border-emerald-600',
    tableHead: isDark
      ? 'bg-[#141311]/80 text-stone-400 border-b border-white/5'
      : 'bg-stone-100/90 text-stone-600 border-b border-stone-200',
    tableRow: isDark
      ? 'hover:bg-white/[0.02]'
      : 'hover:bg-stone-50/90',
    divide: isDark ? 'divide-white/5' : 'divide-stone-200/80',
    heading: isDark ? 'text-stone-100' : 'text-stone-900',
    text: isDark ? 'text-stone-200' : 'text-stone-800',
    muted: isDark ? 'text-stone-400' : 'text-stone-600',
    border: isDark ? 'border-white/5' : 'border-stone-200',
    secondaryBtn: isDark
      ? 'border-white/10 bg-[#262420] text-stone-200 hover:bg-white/10'
      : 'border-stone-300 bg-stone-100 text-stone-800 hover:bg-stone-200',
    modal: isDark
      ? 'border-white/10 bg-[#1e1d1a] text-stone-100'
      : 'border-stone-200 bg-white text-stone-900',
    pillMuted: isDark
      ? 'bg-white/5 border-white/10 text-stone-300'
      : 'bg-stone-100 border-stone-200 text-stone-700',
  };
}
