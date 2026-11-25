import { useEffect, type ReactNode } from 'react';
import { getThemeClasses } from '../lib/theme';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  isDark?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
  isDark = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const t = getThemeClasses(isDark);
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const confirmColors = {
    danger: 'bg-rose-700 hover:bg-rose-600 text-white disabled:bg-rose-900',
    warning: 'bg-[#f59e0b] hover:bg-[#d97706] text-stone-950 font-bold disabled:bg-amber-700',
    primary: 'bg-[#f59e0b] hover:bg-[#d97706] text-stone-950 font-bold disabled:bg-amber-700',
  }[confirmVariant];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#141311]/85 p-4 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 ${t.modal}`}>
        <h3 id="confirm-modal-title" className={`text-base font-semibold ${t.heading}`}>
          {title}
        </h3>
        <div className={`text-sm leading-relaxed ${t.text}`}>
          {message}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            aria-label="Cancel"
            disabled={isLoading}
            onClick={onCancel}
            className={`rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-50 ${t.secondaryBtn}`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${confirmColors}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
