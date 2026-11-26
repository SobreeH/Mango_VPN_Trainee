import mangoLogo from '../assets/mango-logo.png';

interface BrandLogoProps {
  variant?: 'sidebar' | 'header' | 'hero';
  isDark?: boolean;
  badgeText?: string;
}

/**
 * Renders the transparent Mango company logo without any background box.
 * In Dark Mode, `invert hue-rotate-180` turns dark lettering crisp white while preserving the green leaves.
 */
export function BrandLogo({ variant = 'sidebar', isDark = true, badgeText }: BrandLogoProps) {
  const logoFilterClass = isDark ? 'invert hue-rotate-180 brightness-110' : '';

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-3">
        <img
          src={mangoLogo}
          alt="Mango Consultant Co., Ltd."
          className={`h-8 w-auto object-contain select-none shrink-0 transition-all ${logoFilterClass}`}
        />
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-base font-bold tracking-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
              MANGO VPN
            </h1>
            {badgeText && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                {badgeText}
              </span>
            )}
          </div>
          <p className={`text-[10px] font-medium ${isDark ? 'text-stone-400' : 'text-amber-700'}`}>
            Mango Consultant Co., Ltd.
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className="space-y-3">
        <img
          src={mangoLogo}
          alt="Mango Consultant Co., Ltd."
          className={`h-10 w-auto object-contain select-none transition-all ${logoFilterClass}`}
        />
        <div>
          <h1 className={`text-lg font-bold tracking-tight ${isDark ? 'text-stone-100' : 'text-stone-900'}`}>
            MANGO VPN
          </h1>
          <p className={`text-[11px] font-medium ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
            Mango Consultant Co., Ltd.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <img
        src={mangoLogo}
        alt="Mango Consultant Co., Ltd."
        className={`h-9 w-auto object-contain select-none transition-all ${logoFilterClass}`}
      />
      <div>
        <h1 className={`text-base font-bold tracking-tight leading-tight ${isDark ? 'text-stone-100' : 'text-slate-900'}`}>
          MANGO VPN
        </h1>
        <p className={`text-[10px] font-medium ${isDark ? 'text-stone-400' : 'text-amber-700'}`}>
          Mango Consultant Co., Ltd.
        </p>
      </div>
    </div>
  );
}
