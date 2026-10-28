'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { baht, eventDate, myBookings, timeOf } from '@/lib/format';
import type { EventInfo, TableRow, Ticket } from '@/lib/types';
import StatusPill from '@/components/StatusPill';

export default function HomePage() {
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [mine, setMine] = useState<{ id: string; t: Ticket }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([rpc<EventInfo | null>('get_event'), rpc<TableRow[]>('get_tables')])
      .then(([e, t]) => { setEvent(e); setTables(t); })
      .catch((e: Error) => setError(e.message));
    const ids = myBookings();
    Promise.all(ids.map((id) => rpc<Ticket | null>('get_ticket', { p_booking_id: id }).then((t) => (t ? { id, t } : null)).catch(() => null)))
      .then((rows) => setMine(rows.filter((r): r is { id: string; t: Ticket } => r !== null)));
  }, []);

  if (error) return <div className="msg bad">โหลดข้อมูลไม่สำเร็จ: {error}</div>;
  if (!event) return <p className="muted">กำลังโหลด…</p>;

  const totalSeats = tables.reduce((a, t) => a + t.capacity, 0);
  const remaining = tables.reduce((a, t) => a + t.remaining, 0);
  const freeTables = tables.filter((t) => t.remaining > 0).length;

  return (
    <>
      <section className="hero">
        <div className="school">{event.school}</div>
        <h2>{event.name}</h2>
        <dl>
          <dt>วันที่</dt><dd>{eventDate(event.event_date)}</dd>
          <dt>เวลา</dt><dd>{timeOf(event.event_date)}</dd>
          <dt>สถานที่</dt><dd>{event.venue}</dd>
          <dt>ราคา</dt><dd>{baht(event.price_per_seat)} / ที่นั่ง</dd>
        </dl>
        <div><Link className="btn big" href="/tables">เริ่มจองโต๊ะ</Link></div>
      </section>

      <div className="stats">
        <div className="stat"><div className="v">{freeTables}<small> / {tables.length}</small></div><div className="k">โต๊ะที่ยังมีที่ว่าง</div></div>
        <div className="stat"><div className="v">{remaining}</div><div className="k">ที่นั่งคงเหลือ จาก {totalSeats}</div></div>
      </div>

      {mine.length > 0 && (
        <div className="card stack">
          <h3>การจองของฉัน (บนเครื่องนี้)</h3>
          <ul className="linklist">
            {mine.map(({ id, t }) => (
              <li key={id}>
                <Link href={t.payment_status === 'paid' ? `/ticket/${id}` : `/booking/${id}`}>
                  <span><span className="mono">{t.code}</span> · {t.group_name}</span>
                  <StatusPill payment={t.payment_status} status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack">
        <h3>ขั้นตอนการจอง</h3>
        <ol className="steps">
          <li>เลือกโต๊ะและดูที่นั่งคงเหลือ</li>
          <li>กรอกชื่อกลุ่ม ผู้ติดต่อ และจำนวนคน</li>
          <li>ชำระเงิน รอเจ้าหน้าที่ยืนยันยอด</li>
          <li>รับ Group QR ใช้เช็กอินหน้างานได้ตามจำนวนสิทธิ์</li>
        </ol>
      </div>
    </>
  );
}
