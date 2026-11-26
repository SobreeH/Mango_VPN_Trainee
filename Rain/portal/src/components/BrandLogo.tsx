import mangoLogo from '../assets/mango-logo.png';

interface BrandLogoProps {
  variant?: 'sidebar' | 'header' | 'hero';
  isDark?: boolean;
  badgeText?: string;
}

/**
 * Renders the official Mango company logo inside a high-contrast white badge
 * paired with MANGO VPN title and company subtitle, aligned for Sidebar, Header, and Hero layouts.
 */
export function BrandLogo({ variant = 'sidebar', isDark = true, badgeText }: BrandLogoProps) {
  if (variant === 'header') {
    return (
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center rounded-xl bg-white px-2.5 py-1.5 border border-stone-200/80 shadow-sm shrink-0">
          <img
            src={mangoLogo}
            alt="Mango Consultant Co., Ltd."
            className="h-7 w-auto object-contain select-none"
          />
        </div>
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
        <div className="inline-flex items-center justify-center rounded-2xl bg-white px-3.5 py-2 border border-stone-200/80 shadow-sm w-fit">
          <img
            src={mangoLogo}
            alt="Mango Consultant Co., Ltd."
            className="h-9 w-auto object-contain select-none"
          />
        </div>
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
    <div className="space-y-2.5">
      <div className="inline-flex items-center justify-center rounded-2xl bg-white px-3.5 py-2 border border-stone-200/80 shadow-sm w-fit">
        <img
          src={mangoLogo}
          alt="Mango Consultant Co., Ltd."
          className="h-8 w-auto object-contain select-none"
        />
      </div>
      <div className="pl-0.5">
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
