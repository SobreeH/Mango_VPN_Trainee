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
      ? 'border-slate-800/80 bg-slate-900/85 text-slate-100 shadow-2xl backdrop-blur-xl'
      : 'border-slate-200/90 bg-white/95 text-slate-900 shadow-lg shadow-slate-200/60 backdrop-blur-xl',
    subCard: isDark
      ? 'border-slate-800/70 bg-slate-950/60 text-slate-200'
      : 'border-slate-200 bg-slate-50/90 text-slate-800',
    input: isDark
      ? 'border-slate-700/80 bg-slate-800/70 text-slate-100 placeholder-slate-400 focus:border-emerald-400'
      : 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-emerald-600',
    tableHead: isDark
      ? 'bg-slate-950/70 text-slate-400 border-b border-slate-800/80'
      : 'bg-slate-100/90 text-slate-600 border-b border-slate-200',
    tableRow: isDark
      ? 'hover:bg-white/[0.02]'
      : 'hover:bg-slate-50/90',
    divide: isDark ? 'divide-slate-800/70' : 'divide-slate-200/80',
    heading: isDark ? 'text-slate-100' : 'text-slate-900',
    text: isDark ? 'text-slate-200' : 'text-slate-800',
    muted: isDark ? 'text-slate-400' : 'text-slate-600',
    border: isDark ? 'border-slate-800/80' : 'border-slate-200',
    secondaryBtn: isDark
      ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
      : 'border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200',
    modal: isDark
      ? 'border-slate-700/80 bg-slate-900 text-slate-100'
      : 'border-slate-200 bg-white text-slate-900',
    pillMuted: isDark
      ? 'bg-white/5 border-white/10 text-slate-300'
      : 'bg-slate-100 border-slate-200 text-slate-700',
  };
}
