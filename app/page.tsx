'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { baht, eventDate, myBookings, timeOf } from '@/lib/format';
import type { EventInfo, Ticket } from '@/lib/types';
import StatusPill from '@/components/StatusPill';
import Rampoei from '@/components/Rampoei';

export default function HomePage() {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [mine, setMine] = useState<{ id: string; t: Ticket }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    rpc<EventInfo | null>('get_event').then(setEvent).catch((e: Error) => setError(e.message));
    const ids = myBookings();
    Promise.all(ids.map((id) => rpc<Ticket | null>('get_ticket', { p_booking_id: id }).then((t) => (t ? { id, t } : null)).catch(() => null)))
      .then((rows) => setMine(rows.filter((r): r is { id: string; t: Ticket } => r !== null)));
  }, []);

  if (error) return <div className="msg bad">โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  if (!event) return <p className="muted">กำลังโหลด…</p>;

  const remaining = event.seats_total - event.seats_booked;
  const hasFree = event.free_class_from != null && event.free_class_to != null;

  return (
    <>
      <section className="hero">
        <Rampoei size={190} className="hero-flower" />
        <div className="school">{event.school}</div>
        <h2>{event.name}</h2>
        <dl>
          <dt>วันที่</dt><dd>{eventDate(event.event_date)}</dd>
          <dt>เวลา</dt><dd>{timeOf(event.event_date)}</dd>
          <dt>สถานที่</dt><dd>{event.venue}</dd>
          <dt>ราคา</dt><dd>{baht(event.price_per_seat)} / ที่นั่ง</dd>
        </dl>
        <div><Link className="btn big" href="/book">จองที่นั่ง</Link></div>
      </section>

      <div className="stats">
        <div className="stat"><div className="v">{remaining}<small> / {event.seats_total}</small></div><div className="k">ที่นั่งคงเหลือ</div></div>
        <div className="stat"><div className="v">{event.class_min}–{event.class_max}</div><div className="k">รุ่นที่เปิดรับจอง</div></div>
        {hasFree && (
          <div className="stat"><div className="v">{event.free_class_from}–{event.free_class_to}</div><div className="k">รุ่นที่ไม่ต้องชำระเงิน</div></div>
        )}
      </div>

      {mine.length > 0 && (
        <div className="card stack">
          <h3>การจองของฉัน (บนเครื่องนี้)</h3>
          <ul className="linklist">
            {mine.map(({ id, t }) => (
              <li key={id}>
                <Link href={t.payment_status === 'paid' ? `/ticket/${id}` : `/booking/${id}`}>
                  <span><span className="mono">{t.code}</span> · {t.group_name}</span>
                  <StatusPill payment={t.payment_status} status={t.status} free={t.is_free} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack">
        <h3>ขั้นตอนการจอง</h3>
        <ol className="steps">
          <li>เลือกรุ่น กรอกชื่อกลุ่ม ผู้ติดต่อ และจำนวนคน</li>
          <li>โอนเงินตามยอด แล้วแนบสลิปในหน้าชำระเงิน</li>
          <li>เจ้าหน้าที่ตรวจสลิปและจัดโต๊ะให้</li>
          <li>รับ Group QR ใช้เช็กอินหน้างานได้ตามจำนวนสิทธิ์</li>
        </ol>
      </div>
    </>
  );
}
