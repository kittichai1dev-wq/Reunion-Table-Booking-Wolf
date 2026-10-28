'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { sb } from '@/lib/supabase';
import { useSession } from './useSession';

const GUEST = [
  { href: '/', sid: 'S01', name: 'Home' },
  { href: '/tables', sid: 'S02', name: 'เลือกโต๊ะ' },
];
const STAFF = [
  { href: '/staff/checkin', sid: 'S06', name: 'สแกนเช็กอิน' },
  { href: '/admin/dashboard', sid: 'S07', name: 'Dashboard' },
  { href: '/admin/bookings', sid: 'ADM', name: 'รายการจอง' },
];

export default function Nav() {
  const path = usePathname();
  const router = useRouter();
  const session = useSession();
  const links = session ? [...GUEST, ...STAFF] : GUEST;

  async function logout() {
    await sb().auth.signOut();
    router.push('/');
  }

  return (
    <header className="top">
      <div className="brandrow">
        <Link href="/"><h1>Reunion Table Booking</h1></Link>
        <span className="badge-demo">Demo</span>
        <span className="spacer" />
        <span className="who">
          {session ? (
            <>
              <span>{session.user.email}</span>
              <button className="btn ghost sm" type="button" onClick={logout}>ออกจากระบบ</button>
            </>
          ) : session === null ? (
            <Link className="btn ghost sm" href="/staff/login">เข้าสู่ระบบเจ้าหน้าที่</Link>
          ) : null}
        </span>
      </div>
      <nav className="screens" aria-label="หน้าหลัก">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="chip" aria-current={path === l.href ? 'page' : undefined}>
            <b>{l.sid}</b>{l.name}
          </Link>
        ))}
      </nav>
    </header>
  );
}
