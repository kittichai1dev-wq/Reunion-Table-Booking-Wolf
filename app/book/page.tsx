'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { rpc } from '@/lib/supabase';
import { ERROR_TEXT, baht, isFreeClass, rememberBooking } from '@/lib/format';
import type { EventInfo } from '@/lib/types';

type Errs = Partial<Record<'cls' | 'group' | 'contact' | 'phone' | 'seats' | 'form', string>>;
const MAX_SEATS = 10;

export default function BookPage() {
  const router = useRouter();
  const [event, setEvent] = useState<EventInfo | null | undefined>(undefined);
  const [cls, setCls] = useState('');
  const [group, setGroup] = useState('');
  const [contact, setContact] = useState('');
  const [phone, setPhone] = useState('');
  const [seats, setSeats] = useState(5);
  const [errs, setErrs] = useState<Errs>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rpc<EventInfo | null>('get_event').then(setEvent).catch((e: Error) => { setEvent(null); setErrs({ form: e.message }); });
  }, []);

  if (event === undefined) return <p className="muted">กำลังโหลด…</p>;
  if (!event) return <div className="msg bad">ยังไม่มีงานที่เปิดรับจอง {errs.form}</div>;

  const left = event.seats_total - event.seats_booked;
  const maxSeats = Math.max(0, Math.min(MAX_SEATS, left));
  const classNo = cls ? parseInt(cls, 10) : null;
  const free = isFreeClass(classNo, event.free_class_from, event.free_class_to);
  const classes = Array.from({ length: event.class_max - event.class_min + 1 }, (_, i) => event.class_min + i);

  function pickClass(v: string) {
    // prefill the group name while it still matches the previous suggestion
    if (!group.trim() || /^รุ่น \d+$/.test(group.trim())) setGroup(v ? `รุ่น ${v}` : '');
    setCls(v);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errs = {};
    if (!classNo) next.cls = 'เลือกรุ่น';
    if (!group.trim()) next.group = 'กรอกชื่อกลุ่ม';
    if (!contact.trim()) next.contact = 'กรอกชื่อผู้ติดต่อ';
    if (!/^0\d{1,2}-?\d{3}-?\d{4}$/.test(phone.trim())) next.phone = 'กรอกเบอร์โทร 9–10 หลัก เช่น 081-234-5678';
    if (!(seats >= 1)) next.seats = 'อย่างน้อย 1 คน';
    else if (seats > maxSeats) next.seats = left < MAX_SEATS ? `งานนี้เหลือ ${left} ที่` : `จองได้ครั้งละไม่เกิน ${MAX_SEATS} คน`;
    setErrs(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const r = await rpc<{ ok: boolean; code?: string; booking_id?: string; remaining?: number; is_free?: boolean }>('create_booking', {
        p_class_no: classNo, p_group_name: group, p_contact_name: contact, p_phone: phone, p_seats: seats,
      });
      if (!r.ok || !r.booking_id) {
        setErrs(r.code === 'EVENT_FULL' ? { seats: `มีคนจองก่อนแล้ว งานนี้เหลือ ${r.remaining ?? 0} ที่` } : { form: ERROR_TEXT[r.code ?? ''] ?? r.code });
        return;
      }
      rememberBooking(r.booking_id);
      router.push(r.is_free ? `/ticket/${r.booking_id}` : `/booking/${r.booking_id}`);
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
        <h2>จองที่นั่ง</h2>
        <p className="muted">หัวหน้ากลุ่มกรอกครั้งเดียว ได้ QR เดียวใช้เช็กอินทั้งกลุ่ม · เจ้าหน้าที่จะจัดโต๊ะให้ภายหลัง</p>
      </div>
      <div className="selbox">
        <span>ที่นั่งคงเหลือทั้งงาน <b className="num">{left}</b> / {event.seats_total}</span>
        <span className="muted">{baht(event.price_per_seat)} / ที่นั่ง</span>
      </div>
      <form className="card stack" onSubmit={submit} noValidate>
        <div className={`field ${errs.cls ? 'err' : ''}`}>
          <label htmlFor="f_cls">รุ่น</label>
          <select id="f_cls" value={cls} onChange={(e) => pickClass(e.target.value)}>
            <option value="">เลือกรุ่น ({event.class_min}–{event.class_max})</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                รุ่น {c}{isFreeClass(c, event.free_class_from, event.free_class_to) ? ' · ไม่ต้องชำระ' : ''}
              </option>
            ))}
          </select>
          {errs.cls && <span className="errmsg">{errs.cls}</span>}
        </div>
        {field('group', 'ชื่อกลุ่ม', group, setGroup, 'text', 'เช่น รุ่น 100 ห้อง 6/1', 'ชื่อที่จะแสดงบนตั๋วและหน้าจอเจ้าหน้าที่')}
        {field('contact', 'ชื่อผู้ติดต่อ', contact, setContact, 'text', 'ชื่อ-นามสกุล')}
        {field('phone', 'โทรศัพท์', phone, setPhone, 'tel', '08x-xxx-xxxx', 'ใช้ติดต่อกลับเท่านั้น ไม่ถูกใส่ลงใน QR')}
        <div className={`field ${errs.seats ? 'err' : ''}`}>
          <label htmlFor="f_seats">จำนวนคน</label>
          <div className="stepper">
            <button className="btn ghost" type="button" aria-label="ลดจำนวน" onClick={() => setSeats((s) => Math.max(1, s - 1))}>−</button>
            <input id="f_seats" type="number" min={1} max={maxSeats} value={seats} inputMode="numeric" onChange={(e) => setSeats(parseInt(e.target.value, 10) || 0)} />
            <button className="btn ghost" type="button" aria-label="เพิ่มจำนวน" onClick={() => setSeats((s) => Math.min(maxSeats, s + 1))}>+</button>
          </div>
          {errs.seats ? <span className="errmsg">{errs.seats}</span> : (
            <span className="hint">ครั้งละไม่เกิน {maxSeats} คน · ยอดชำระ <b>{free ? 'ไม่ต้องชำระ' : baht(Math.max(0, seats) * event.price_per_seat)}</b></span>
          )}
        </div>
        {free && <div className="msg ok">รุ่น {classNo} ไม่ต้องชำระเงิน ได้รับ QR ทันทีหลังบันทึก</div>}
        {errs.form && <div className="msg bad">{errs.form}</div>}
        <button className="btn big" type="submit" disabled={saving || maxSeats === 0}>
          {maxSeats === 0 ? 'ที่นั่งเต็มแล้ว' : saving ? 'กำลังบันทึก…' : 'บันทึก Booking'}
        </button>
      </form>
    </>
  );
}
