import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.js';
import './index.css';

// สร้างตัวจัดการ Cache กลางสำหรับทั้งระบบ (Query Client)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // จดจำ Cache ไว้นาน 30 วินาที ก่อนจะอนุญาตให้ดึงใหม่
      retry: 1,             // ถ้าดึงพลาด ให้ลองใหม่อีกแค่ 1 ครั้งพอ
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ครอบ QueryClientProvider เพื่อให้ทุก Component ภายในสามารถใช้ useQuery ได้ */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
