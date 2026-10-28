'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from './useSession';

export default function RequireStaff({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const path = usePathname();
  if (session === undefined) return <p className="muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (!session)
    return (
      <div className="card empty">
        <p>หน้านี้สำหรับเจ้าหน้าที่ กรุณาเข้าสู่ระบบก่อน</p>
        <Link className="btn" href={`/staff/login?next=${encodeURIComponent(path)}`}>เข้าสู่ระบบ</Link>
      </div>
    );
  return <>{children}</>;
}
