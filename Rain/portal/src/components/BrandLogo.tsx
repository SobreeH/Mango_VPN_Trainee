import mangoLogo from '../assets/mango-logo.png';

interface BrandLogoProps {
  variant?: 'sidebar' | 'header' | 'hero';
  isDark?: boolean;
  badgeText?: string;
}

/**
 * Renders the transparent Mango company logo paired with a compact VPN badge
 * and subtle company subtitle—avoiding redundant stacked "MANGO" headings.
 */
export function BrandLogo({ variant = 'sidebar', isDark = true, badgeText }: BrandLogoProps) {
  const logoFilterClass = isDark ? 'invert hue-rotate-180 brightness-110' : '';
  const vpnPillClass = isDark
    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
    : 'bg-amber-500/15 border-amber-600/30 text-amber-700';

  if (variant === 'header') {
    return (
      <div className="flex items-center gap-3">
        <img
          src={mangoLogo}
          alt="Mango Consultant Co., Ltd."
          className={`h-8 w-auto object-contain select-none shrink-0 transition-all ${logoFilterClass}`}
        />
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider border ${vpnPillClass}`}>
              VPN
            </span>
            {badgeText && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
                {badgeText}
              </span>
            )}
          </div>
          <p className={`text-[10px] font-medium ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
            Mango Consultant Co., Ltd.
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className="space-y-2">
        <div className="flex items-end gap-2.5">
          <img
            src={mangoLogo}
            alt="Mango Consultant Co., Ltd."
            className={`h-10 w-auto object-contain select-none transition-all ${logoFilterClass}`}
          />
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-extrabold tracking-wider border mb-1 ${vpnPillClass}`}>
            VPN
          </span>
        </div>
        <p className={`text-[11px] font-medium ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
          Mango Consultant Co., Ltd.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <img
          src={mangoLogo}
          alt="Mango Consultant Co., Ltd."
          className={`h-8 w-auto object-contain select-none transition-all ${logoFilterClass}`}
        />
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wider border mb-0.5 ${vpnPillClass}`}>
          VPN
        </span>
      </div>
      <p className={`text-[10px] font-medium tracking-wide ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
        Mango Consultant Co., Ltd.
      </p>
    </div>
  );
}
