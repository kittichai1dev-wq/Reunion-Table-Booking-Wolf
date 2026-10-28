'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { ERROR_TEXT, baht, pad2 } from '@/lib/format';
import type { EventInfo, Ticket } from '@/lib/types';
import StatusPill from '@/components/StatusPill';
import { useSession } from '@/components/useSession';

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const [t, setT] = useState<Ticket | null | undefined>(undefined);
  const [price, setPrice] = useState(0);
  const [msg, setMsg] = useState<{ k: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    rpc<Ticket | null>('get_ticket', { p_booking_id: id }).then(setT).catch(() => setT(null));
  }, [id]);

  useEffect(() => {
    load();
    rpc<EventInfo | null>('get_event').then((e) => setPrice(e?.price_per_seat ?? 0)).catch(() => {});
  }, [load]);

  // Guest waits on this page; check every 10 s until the admin approves
  useEffect(() => {
    if (!t || t.payment_status === 'paid' || t.status === 'cancelled') return;
    const h = setInterval(load, 10_000);
    return () => clearInterval(h);
  }, [t, load]);

  async function approve() {
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; code?: string }>('approve_payment', { p_booking_id: id });
      setMsg(r.ok ? { k: 'ok', text: 'ยืนยันชำระแล้ว · QR เปิดใช้งาน' } : { k: 'bad', text: ERROR_TEXT[r.code ?? ''] ?? String(r.code) });
      load();
    } catch (e) {
      setMsg({ k: 'bad', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (t === undefined) return <p className="muted">กำลังโหลด…</p>;
  if (!t) return <div className="card empty"><p>ไม่พบ Booking นี้</p><Link className="btn" href="/tables">เริ่มจอง</Link></div>;

  return (
    <>
      <span className="sid">S04 · Guest / Admin</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>ชำระเงิน</h2>
        <p className="muted">ต้นแบบนี้ไม่รับเงินจริง สถานะเปลี่ยนเป็น Paid เมื่อเจ้าหน้าที่กดยืนยันเท่านั้น</p>
      </div>
      <div className="card stack">
        <div className="row between"><span className="mono">{t.code}</span><StatusPill payment={t.payment_status} status={t.status} /></div>
        <div>
          <div className="muted">ยอดที่ต้องชำระ</div>
          <div className="amount">{baht(t.seat_count * price)}</div>
          <div className="muted num">{t.seat_count} ที่นั่ง × {baht(price)}</div>
        </div>
        <dl className="kv">
          <dt>กลุ่ม</dt><dd>{t.group_name}</dd>
          <dt>โต๊ะ</dt><dd>{pad2(t.table_no)}</dd>
        </dl>
        {t.status === 'cancelled' && <div className="msg bad">Booking นี้ถูกยกเลิกแล้ว</div>}
        {t.status === 'active' && t.payment_status === 'pending' && (
          <p className="notice">รอเจ้าหน้าที่ยืนยันยอด หน้านี้จะอัปเดตเองเมื่อยืนยันแล้ว · เก็บลิงก์หน้านี้ไว้เพื่อกลับมาดูตั๋ว</p>
        )}
        {t.payment_status === 'paid' && t.status === 'active' && (
          <Link className="btn big" href={`/ticket/${id}`}>ดู Group Ticket</Link>
        )}
      </div>

      {session && t.status === 'active' && t.payment_status === 'pending' && (
        <div className="adminbox">
          <span className="tag">Admin · Demo only</span>
          <p>จำลองการตรวจยอดของเจ้าหน้าที่ เมื่อยืนยันแล้ว QR ของกลุ่มนี้จะเปิดใช้งาน</p>
          <div><button className="btn accent" type="button" onClick={approve} disabled={busy}>ยืนยันชำระเงิน (Demo)</button></div>
        </div>
      )}
      {msg && <div className={`msg ${msg.k}`}>{msg.text}</div>}
    </>
  );
}
