import React from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { Language } from '../i18n/translations';

interface LanguageSwitcherProps {
  compact?: boolean;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ compact = false }) => {
  const { lang, setLang, t } = useI18n();

  const options: { code: Language; label: string }[] = [
    { code: 'th', label: 'TH' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div
      className={`inline-flex items-center rounded-lg bg-slate-900/90 border border-slate-800 p-0.5 select-none ${
        compact ? 'text-[10px]' : 'text-xs'
      }`}
      role="group"
      aria-label={t.common.languageLabel}
    >
      <Globe className={`text-slate-400 shrink-0 ${compact ? 'w-3 h-3 mx-1.5' : 'w-3.5 h-3.5 mx-1.5'}`} />
      {options.map((opt) => {
        const active = lang === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLang(opt.code)}
            className={`px-2 py-1 rounded-md font-mono font-semibold transition cursor-pointer ${
              active
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
