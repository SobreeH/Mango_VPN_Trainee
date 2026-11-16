import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

// =========================================================================
// 1. Props Interface
// =========================================================================
export interface ToastProps {
  message: string;              // ข้อความที่จะให้แสดง
  type?: ToastType;             // ชนิดของการแจ้งเตือน ('success' | 'error' | 'info')
  durationMs?: number;          // ระยะเวลาที่จะให้แสดงก่อนหายไปเอง (ค่าเริ่มต้น 3500ms)
  onClose: () => void;          // ฟังก์ชันสำหรับปิด Toast
}

// =========================================================================
// 2. Component Toast: กล่องป๊อปอัปแจ้งเตือนมุมบนขวา
// =========================================================================
export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  durationMs = 3500,
  onClose,
}) => {
  // นับเวลาถอยหลังเพื่อสั่งปิด Toast อัตโนมัติ
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);

    // เคลียร์ Timer ทิ้งเมื่อ Component ถูกปิด ป้องกัน Memory Leak
    return () => clearTimeout(timer);
  }, [durationMs, onClose]);

  // กำหนดสีและไอคอนตาม type
  const config = {
    success: {
      border: 'border-emerald-500/80',
      bg: 'bg-slate-900/95',
      text: 'text-emerald-300',
      shadow: 'shadow-emerald-500/10',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
    },
    error: {
      border: 'border-rose-500/80',
      bg: 'bg-slate-900/95',
      text: 'text-rose-300',
      shadow: 'shadow-rose-500/10',
      icon: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
    },
    info: {
      border: 'border-amber-500/80',
      bg: 'bg-slate-900/95',
      text: 'text-amber-300',
      shadow: 'shadow-amber-500/10',
      icon: <Info className="w-5 h-5 text-amber-400 shrink-0" />,
    },
  }[type];

  return (
    <aside
      aria-label="การแจ้งเตือน"
      className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl border ${config.border} ${config.bg} shadow-2xl ${config.shadow} backdrop-blur-md max-w-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
    >
      {/* ไอคอนตามประเภท */}
      {config.icon}

      {/* ข้อความแจ้งเตือน */}
      <div className={`text-xs font-medium leading-relaxed ${config.text} flex-1`}>
        {message}
      </div>

      {/* ปุ่มกดปิดด้วยตัวเอง (กากบาท X) */}
      <button
        onClick={onClose}
        className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
        title="ปิดการแจ้งเตือน"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </aside>
  );
};
