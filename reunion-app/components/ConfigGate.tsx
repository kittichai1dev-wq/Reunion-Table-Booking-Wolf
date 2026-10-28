import { hasConfig } from '@/lib/supabase';

export default function ConfigGate({ children }: { children: React.ReactNode }) {
  if (hasConfig) return <>{children}</>;
  return (
    <div className="card stack">
      <h2>ยังไม่ได้ตั้งค่า Supabase</h2>
      <p>
        ใส่ค่า <code className="mono">NEXT_PUBLIC_SUPABASE_URL</code> และ <code className="mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> ในไฟล์{' '}
        <code className="mono">.env.local</code> (หรือ Environment Variables บน Vercel) แล้วรันใหม่
      </p>
      <p className="muted">ดูค่าได้ที่ Supabase &gt; Project Settings &gt; API</p>
    </div>
  );
}
