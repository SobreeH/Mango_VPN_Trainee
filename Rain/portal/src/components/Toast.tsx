import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: () => {},
      removeToast: () => {},
    };
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, duration = 4000 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const config = {
    success: {
      bg: 'bg-[#162a1e]/95 border-emerald-500/30 text-emerald-200',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />,
      titleColor: 'text-emerald-100',
    },
    error: {
      bg: 'bg-[#2a1719]/95 border-rose-500/30 text-rose-200',
      icon: <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />,
      titleColor: 'text-rose-100',
    },
    warning: {
      bg: 'bg-[#2a2417]/95 border-amber-500/30 text-amber-200',
      icon: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />,
      titleColor: 'text-amber-100',
    },
    info: {
      bg: 'bg-[#1c222a]/95 border-blue-500/30 text-blue-200',
      icon: <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />,
      titleColor: 'text-blue-100',
    },
  }[toast.type];

  return (
    <div
      role="status"
      className={`pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 flex items-start gap-3 ${config.bg}`}
    >
      {config.icon}
      <div className="flex-1 min-w-0 pr-1">
        {toast.title && (
          <h4 className={`text-xs font-bold leading-tight mb-0.5 ${config.titleColor}`}>
            {toast.title}
          </h4>
        )}
        <p className="text-[12px] opacity-90 leading-relaxed break-words">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
