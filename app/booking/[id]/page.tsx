'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { ERROR_TEXT, baht, dateTime, tableLabel } from '@/lib/format';
import type { EventInfo, RpcResult, Ticket } from '@/lib/types';
import StatusPill from '@/components/StatusPill';
import SlipUpload from '@/components/SlipUpload';
import { useSession } from '@/components/useSession';

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession();
  const [t, setT] = useState<Ticket | null | undefined>(undefined);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [msg, setMsg] = useState<{ k: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    rpc<Ticket | null>('get_ticket', { p_booking_id: id }).then(setT).catch(() => setT(null));
  }, [id]);

  useEffect(() => {
    load();
    rpc<EventInfo | null>('get_event').then(setEvent).catch(() => {});
  }, [load]);

  // Guest waits on this page; check every 10 s until staff approve the slip
  useEffect(() => {
    if (!t || t.payment_status === 'paid' || t.status === 'cancelled') return;
    const h = setInterval(load, 10_000);
    return () => clearInterval(h);
  }, [t, load]);

  async function approve() {
    setBusy(true);
    try {
      const r = await rpc<RpcResult>('approve_payment', { p_booking_id: id });
      setMsg(r.ok ? { k: 'ok', text: 'ยืนยันชำระแล้ว · QR เปิดใช้งาน' } : { k: 'bad', text: ERROR_TEXT[r.code ?? ''] ?? String(r.code) });
      load();
    } catch (e) {
      setMsg({ k: 'bad', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function copyAccount(no: string) {
    try { await navigator.clipboard.writeText(no.replace(/[^0-9]/g, '')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }

  if (t === undefined) return <p className="muted">กำลังโหลด…</p>;
  if (!t) return <div className="card empty"><p>ไม่พบ Booking นี้</p><Link className="btn" href="/book">เริ่มจอง</Link></div>;

  const pending = t.status === 'active' && t.payment_status === 'pending';

  return (
    <>
      <span className="sid">S04 · Guest / Admin</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>ชำระเงิน</h2>
        <p className="muted">โอนเงินตามยอด แล้วแนบสลิป เจ้าหน้าที่ตรวจแล้วจะเปิดใช้งาน QR ให้ · เก็บลิงก์หน้านี้ไว้เพื่อกลับมาดูสถานะ</p>
      </div>
      <div className="card stack">
        <div className="row between"><span className="mono">{t.code}</span><StatusPill payment={t.payment_status} status={t.status} free={t.is_free} /></div>
        <div>
          <div className="muted">ยอดที่ต้องชำระ</div>
          <div className="amount">{t.is_free ? 'ไม่ต้องชำระ' : baht(t.amount)}</div>
          {!t.is_free && event && <div className="muted num">{t.seat_count} ที่นั่ง × {baht(event.price_per_seat)}</div>}
        </div>
        <dl className="kv">
          <dt>รุ่น</dt><dd>{t.class_no ?? '-'}</dd>
          <dt>กลุ่ม</dt><dd>{t.group_name}</dd>
          <dt>โต๊ะ</dt><dd>{tableLabel(t.table_no)}</dd>
        </dl>
        {t.status === 'cancelled' && <div className="msg bad">Booking นี้ถูกยกเลิกแล้ว</div>}
        {pending && t.has_slip && <div className="msg ok">แนบสลิปแล้วเมื่อ {dateTime(t.slip_uploaded_at)} · รอเจ้าหน้าที่ตรวจสอบ หน้านี้จะอัปเดตเอง</div>}
        {t.payment_status === 'paid' && t.status === 'active' && <Link className="btn big" href={`/ticket/${id}`}>ดู Group Ticket</Link>}
      </div>

      {pending && (
        <div className="card stack bank">
          <h3>บัญชีสำหรับโอน</h3>
          {event?.bank_account_no ? (
            <>
              <dl className="kv">
                <dt>ธนาคาร</dt><dd>{event.bank_name}</dd>
                <dt>เลขบัญชี</dt><dd className="mono acct">{event.bank_account_no}</dd>
                <dt>ชื่อบัญชี</dt><dd>{event.bank_account_name}</dd>
              </dl>
              <div className="row">
                <button className="btn ghost sm" type="button" onClick={() => copyAccount(event.bank_account_no!)}>คัดลอกเลขบัญชี</button>
                {copied && <span className="muted" style={{ fontSize: '.82rem' }}>คัดลอกแล้ว</span>}
              </div>
            </>
          ) : (
            <p className="notice">ผู้จัดงานยังไม่ได้ใส่เลขบัญชี กรุณาติดต่อคณะกรรมการรุ่นก่อนโอน</p>
          )}
        </div>
      )}

      {pending && <SlipUpload bookingId={id} hasSlip={t.has_slip} onDone={load} />}

      {session && pending && (
        <div className="adminbox">
          <span className="tag">Admin</span>
          <p>{t.has_slip ? 'ตรวจสลิปได้ที่หน้ารายการจอง หรือยืนยันจากที่นี่เมื่อตรวจยอดแล้ว' : 'กลุ่มนี้ยังไม่ได้แนบสลิป'}</p>
          <div className="row">
            <button className="btn accent" type="button" onClick={approve} disabled={busy}>ยืนยันชำระเงิน</button>
            <Link className="btn ghost" href="/admin/bookings">ไปหน้ารายการจอง</Link>
          </div>
        </div>
      )}
      {msg && <div className={`msg ${msg.k}`}>{msg.text}</div>}
    </>
  );
}
