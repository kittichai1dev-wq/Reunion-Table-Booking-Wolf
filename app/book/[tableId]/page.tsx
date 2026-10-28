'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { rpc } from '@/lib/supabase';
import { ERROR_TEXT, baht, pad2, rememberBooking } from '@/lib/format';
import type { EventInfo, TableRow } from '@/lib/types';

type Errs = Partial<Record<'group' | 'contact' | 'phone' | 'seats' | 'form', string>>;

export default function BookPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const [table, setTable] = useState<TableRow | null | undefined>(undefined);
  const [price, setPrice] = useState(0);
  const [group, setGroup] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(1);
  const [errs, setErrs] = useState<Errs>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([rpc<TableRow[]>('get_tables'), rpc<EventInfo | null>('get_event')])
      .then(([rows, ev]) => {
        const t = rows.find((r) => r.table_id === tableId) ?? null;
        setTable(t);
        setPrice(ev?.price_per_seat ?? 0);
        if (t) setSeats(Math.max(1, Math.min(5, t.remaining)));
      })
      .catch((e: Error) => { setTable(null); setErrs({ form: e.message }); });
  }, [tableId]);

  if (table === undefined) return <p className="muted">กำลังโหลด…</p>;
  if (!table)
    return (
      <div className="card empty">
        <p>ไม่พบโต๊ะนี้ {errs.form}</p>
        <Link className="btn" href="/tables">ไปเลือกโต๊ะ</Link>
      </div>
    );

  const left = table.remaining;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errs = {};
    if (!group.trim()) next.group = 'กรอกชื่อกลุ่ม';
    if (!contact.trim()) next.contact = 'กรอกชื่อผู้ติดต่อ';
    if (!/^0\d{1,2}-?\d{3}-?\d{4}$/.test(phone.trim())) next.phone = 'กรอกเบอร์โทร 9–10 หลัก เช่น 081-234-5678';
    if (!(seats >= 1)) next.seats = 'อย่างน้อย 1 คน';
    else if (seats > left) next.seats = `โต๊ะนี้เหลือ ${left} ที่`;
    setErrs(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const r = await rpc<{ ok: boolean; code?: string; booking_id?: string; remaining?: number }>('create_booking', {
        p_table_id: tableId, p_group_name: group, p_contact_name: contact, p_phone: phone, p_seats: seats,
      });
      if (!r.ok || !r.booking_id) {
        setErrs(r.code === 'TABLE_FULL'
          ? { seats: `มีคนจองก่อนแล้ว โต๊ะนี้เหลือ ${r.remaining ?? 0} ที่` }
          : { form: ERROR_TEXT[r.code ?? ''] ?? r.code });
        if (r.code === 'TABLE_FULL') setTable({ ...table!, remaining: r.remaining ?? 0 });
        return;
      }
      rememberBooking(r.booking_id);
      router.push(`/booking/${r.booking_id}`);
    } catch (err) {
      setErrs({ form: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const field = (id: 'group' | 'contact' | 'phone', label: string, value: string, set: (v: string) => void, type: string, ph: string, hint?: string) => (
    <div className={`field ${errs[id] ? 'err' : ''}`}>
      <label htmlFor={`f_${id}`}>{label}</label>
      <input id={`f_${id}`} type={type} value={value} placeholder={ph} autoComplete="off" onChange={(e) => set(e.target.value)} />
      {errs[id] ? <span className="errmsg">{errs[id]}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );

  return (
    <>
      <span className="sid">S03 · Guest</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>สร้าง Group Booking</h2>
        <p className="muted">หัวหน้ากลุ่มกรอกครั้งเดียว ได้ QR เดียวใช้เช็กอินทั้งกลุ่ม</p>
      </div>
      <div className="selbox">
        <span><b>โต๊ะ {pad2(table.table_no)}</b> · ว่าง {left} / {table.capacity} ที่</span>
        <Link className="btn ghost sm" href="/tables">เปลี่ยนโต๊ะ</Link>
      </div>
      <form className="card stack" onSubmit={submit} noValidate>
        {field('group', 'ชื่อกลุ่ม', group, setGroup, 'text', 'เช่น ห้อง ม.6/4', 'ชื่อที่จะแสดงบนตั๋วและหน้าจอเจ้าหน้าที่')}
        {field('contact', 'ชื่อผู้ติดต่อ', contact, setContact, 'text', 'ชื่อ-นามสกุล')}
        {field('phone', 'โทรศัพท์', phone, setPhone, 'tel', '08x-xxx-xxxx', 'ใช้ติดต่อกลับเท่านั้น ไม่ถูกใส่ลงใน QR')}
        <div className={`field ${errs.seats ? 'err' : ''}`}>
          <label htmlFor="f_seats">จำนวนคน</label>
          <div className="stepper">
            <button className="btn ghost" type="button" aria-label="ลดจำนวน" onClick={() => setSeats((s) => Math.max(1, s - 1))}>−</button>
            <input id="f_seats" type="number" min={1} max={left} value={seats} inputMode="numeric" onChange={(e) => setSeats(parseInt(e.target.value, 10) || 0)} />
            <button className="btn ghost" type="button" aria-label="เพิ่มจำนวน" onClick={() => setSeats((s) => Math.min(left, s + 1))}>+</button>
          </div>
          {errs.seats ? <span className="errmsg">{errs.seats}</span> : (
            <span className="hint">สูงสุด {left} คนสำหรับโต๊ะนี้ · ยอดชำระ <b>{baht(Math.max(0, seats) * price)}</b></span>
          )}
        </div>
        {errs.form && <div className="msg bad">{errs.form}</div>}
        <button className="btn big" type="submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก Booking'}</button>
      </form>
    </>
  );
}
