'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { eventDate, pad2, timeOf } from '@/lib/format';
import type { EventInfo, Ticket } from '@/lib/types';
import StatusPill from '@/components/StatusPill';
import QrImage from '@/components/QrImage';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const [t, setT] = useState<Ticket | null | undefined>(undefined);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(() => {
    rpc<Ticket | null>('get_ticket', { p_booking_id: id }).then(setT).catch(() => setT(null));
  }, [id]);

  useEffect(() => {
    load();
    rpc<EventInfo | null>('get_event').then(setEvent).catch(() => {});
    const h = setInterval(load, 30_000);
    return () => clearInterval(h);
  }, [load]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied('คัดลอกลิงก์ตั๋วแล้ว');
    } catch {
      setCopied('คัดลอกไม่ได้ ให้คัดลอกจากแถบที่อยู่แทน');
    }
  }

  if (t === undefined) return <p className="muted">กำลังโหลด…</p>;
  if (!t) return <div className="card empty"><p>ไม่พบตั๋วนี้</p><Link className="btn" href="/">กลับหน้าแรก</Link></div>;

  const paid = t.payment_status === 'paid' && t.status === 'active';

  return (
    <>
      <span className="sid">S05 · Guest</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>Group Ticket</h2>
        <p className="muted">QR เดียวต่อกลุ่ม สแกนซ้ำได้จนกว่าจะเช็กอินครบจำนวนสิทธิ์</p>
      </div>
      <article className="ticket">
        <div className="th">
          <small>{event?.school}</small>
          <h3>{event?.name}</h3>
          {event && <small>{eventDate(event.event_date)} · {timeOf(event.event_date)}</small>}
        </div>
        <div className="tb">
          <div className="row between" style={{ width: '100%' }}>
            <span className="mono">{t.code}</span>
            <StatusPill payment={t.payment_status} status={t.status} free={t.is_free} />
          </div>
          <QrImage value={t.qr_token} locked={!paid} />
          <div className="perf" />
          <dl className="kv">
            <dt>กลุ่ม</dt><dd>{t.group_name}</dd>
            <dt>รุ่น</dt><dd>{t.class_no ?? '-'}</dd>
            <dt>โต๊ะ</dt><dd>{t.table_no == null ? 'รอเจ้าหน้าที่จัดโต๊ะ' : pad2(t.table_no)}</dd>
            <dt>สิทธิ์เข้างาน</dt><dd className="num">{t.seat_count} คน</dd>
          </dl>
          <div className="meter">
            <div className="row between"><span>เช็กอินแล้ว</span><b className="num">{t.checked_in} / {t.seat_count}</b></div>
            <div className="bar"><i style={{ width: `${(t.checked_in / t.seat_count) * 100}%` }} /></div>
          </div>
          <div className="row" style={{ width: '100%' }}>
            <button className="btn ghost sm" type="button" onClick={copyLink}>คัดลอกลิงก์ตั๋วให้เพื่อนในกลุ่ม</button>
            {copied && <span className="muted" style={{ fontSize: '.82rem' }}>{copied}</span>}
          </div>
          <p className="muted" style={{ fontSize: '.8rem', textAlign: 'center' }}>QR เก็บเฉพาะ Token สุ่ม ไม่มีชื่อหรือเบอร์โทร</p>
        </div>
      </article>
      {!paid && t.status === 'active' && <Link className="btn ghost" href={`/booking/${id}`}>ไปหน้าชำระเงิน</Link>}
    </>
  );
}
