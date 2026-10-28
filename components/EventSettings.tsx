'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { rpc } from '@/lib/supabase';
import { ERROR_TEXT } from '@/lib/format';
import type { EventInfo } from '@/lib/types';

// Admin: free class range, seat price and bank account shown on the payment page
export default function EventSettings({ onSaved }: { onSaved: () => void }) {
  const [ev, setEv] = useState<EventInfo | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [price, setPrice] = useState('');
  const [bank, setBank] = useState('');
  const [acct, setAcct] = useState('');
  const [acctName, setAcctName] = useState('');
  const [msg, setMsg] = useState<{ k: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rpc<EventInfo | null>('get_event').then((e) => {
      if (!e) return;
      setEv(e);
      setFrom(e.free_class_from?.toString() ?? '');
      setTo(e.free_class_to?.toString() ?? '');
      setPrice(String(e.price_per_seat));
      setBank(e.bank_name ?? '');
      setAcct(e.bank_account_no ?? '');
      setAcctName(e.bank_account_name ?? '');
    });
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const num = (v: string) => (v.trim() ? parseInt(v, 10) : null);
    try {
      const r = await rpc<{ ok: boolean; code?: string; converted?: number }>('update_event_settings', {
        p_free_from: num(from), p_free_to: num(to), p_price: num(price),
        p_bank_name: bank, p_bank_account_no: acct, p_bank_account_name: acctName,
      });
      if (!r.ok) setMsg({ k: 'bad', text: ERROR_TEXT[r.code ?? ''] ?? String(r.code) });
      else {
        setMsg({ k: 'ok', text: `บันทึกแล้ว${r.converted ? ` · เปลี่ยน ${r.converted} Booking ที่รอชำระเป็น "ไม่ต้องชำระ"` : ''}` });
        onSaved();
      }
    } catch (err) {
      setMsg({ k: 'bad', text: (err as Error).message });
    }
    setBusy(false);
  }

  if (!ev) return null;
  const classOpts = Array.from({ length: ev.class_max - ev.class_min + 1 }, (_, i) => ev.class_min + i);
  const classSelect = (id: string, value: string, set: (v: string) => void) => (
    <select id={id} value={value} onChange={(e) => set(e.target.value)}>
      <option value="">ไม่กำหนด</option>
      {classOpts.map((c) => <option key={c} value={c}>รุ่น {c}</option>)}
    </select>
  );

  return (
    <details className="card settings">
      <summary>
        <b>ตั้งค่างาน</b>
        <span className="muted">
          {ev.free_class_from != null ? ` · รุ่นฟรี ${ev.free_class_from}–${ev.free_class_to}` : ' · ทุกรุ่นชำระเงิน'}
          {ev.bank_account_no ? '' : ' · ยังไม่ใส่เลขบัญชี'}
        </span>
      </summary>
      <form className="stack" onSubmit={save} style={{ marginTop: 14 }}>
        <div className="grid2">
          <div className="field"><label htmlFor="free-from">รุ่นที่ไม่ต้องชำระ ตั้งแต่</label>{classSelect('free-from', from, setFrom)}</div>
          <div className="field"><label htmlFor="free-to">ถึงรุ่น</label>{classSelect('free-to', to, setTo)}</div>
        </div>
        <p className="hint muted" style={{ fontSize: '.8rem' }}>Booking ที่ยังรอชำระของรุ่นในช่วงนี้จะเปลี่ยนเป็นไม่ต้องชำระทันที ส่วนที่ชำระแล้วไม่เปลี่ยน</p>
        <div className="grid2">
          <div className="field"><label htmlFor="price">ราคาต่อที่นั่ง (บาท)</label><input id="price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div className="field"><label htmlFor="bank">ธนาคาร</label><input id="bank" value={bank} placeholder="เช่น กสิกรไทย" onChange={(e) => setBank(e.target.value)} /></div>
          <div className="field"><label htmlFor="acct">เลขบัญชี</label><input id="acct" value={acct} placeholder="xxx-x-xxxxx-x" onChange={(e) => setAcct(e.target.value)} /></div>
          <div className="field"><label htmlFor="acct-name">ชื่อบัญชี</label><input id="acct-name" value={acctName} onChange={(e) => setAcctName(e.target.value)} /></div>
        </div>
        {msg && <div className={`msg ${msg.k}`}>{msg.text}</div>}
        <div><button className="btn" type="submit" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}</button></div>
      </form>
    </details>
  );
}
