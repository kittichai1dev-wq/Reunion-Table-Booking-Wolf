'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { sb } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง'); return; }
    const next = new URLSearchParams(window.location.search).get('next');
    router.push(next && next.startsWith('/') ? next : '/staff/checkin');
  }

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <h2>เข้าสู่ระบบเจ้าหน้าที่</h2>
        <p className="muted">สำหรับ Staff และ Admin · บัญชีสร้างโดยผู้ดูแลใน Supabase</p>
      </div>
      <form className="card stack" onSubmit={submit} style={{ maxWidth: 420 }}>
        <div className="field">
          <label htmlFor="email">อีเมล</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">รหัสผ่าน</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="msg bad">{error}</div>}
        <button className="btn big" type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}</button>
      </form>
    </>
  );
}
