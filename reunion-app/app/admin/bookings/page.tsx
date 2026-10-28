'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { rpc, sb } from '@/lib/supabase';
import { ERROR_TEXT, pad2, statusKey } from '@/lib/format';
import type { GroupSummary } from '@/lib/types';
import RequireStaff from '@/components/RequireStaff';
import StatusPill from '@/components/StatusPill';
import ExportButton from '@/components/ExportButton';

const FILTERS = [
  { k: 'all', label: 'ทั้งหมด' },
  { k: 'pending', label: 'รอชำระ' },
  { k: 'paid', label: 'ชำระแล้ว' },
  { k: 'cancelled', label: 'ยกเลิก' },
];

function Bookings() {
  const [rows, setRows] = useState<GroupSummary[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ k: string; text: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await sb().from('v_group_summary').select('*').order('code');
    if (error) { setMsg({ k: 'bad', text: error.message }); return; }
    setRows(data as GroupSummary[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn: 'approve_payment' | 'cancel_booking', id: string, done: string) {
    try {
      const r = await rpc<{ ok: boolean; code?: string }>(fn, { p_booking_id: id });
      setMsg(r.ok ? { k: 'ok', text: done } : { k: 'bad', text: ERROR_TEXT[r.code ?? ''] ?? String(r.code) });
    } catch (e) {
      setMsg({ k: 'bad', text: (e as Error).message });
    }
    setConfirmCancel(null);
    load();
  }

  const shown = (rows ?? []).filter((r) =>
    (filter === 'all' || statusKey(r.payment_status, r.status) === filter) &&
    (!q.trim() || `${r.code} ${r.group_name} ${r.contact_name} ${r.phone}`.toLowerCase().includes(q.trim().toLowerCase())),
  );

  return (
    <>
      <span className="sid">ADM · Admin</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>รายการจอง</h2>
        <p className="muted">ยืนยันชำระเงิน (Demo) หรือยกเลิก Booking · การยกเลิกจะคืนที่นั่งให้โต๊ะ</p>
      </div>
      <div className="row between">
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f.k} type="button" aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>{f.label}</button>
          ))}
        </div>
        <ExportButton />
      </div>
      <div className="field">
        <input id="search" placeholder="ค้นหาเลข Booking ชื่อกลุ่ม ผู้ติดต่อ หรือเบอร์โทร" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
      </div>
      {msg && <div className={`msg ${msg.k}`}>{msg.text}</div>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>เลข</th><th>กลุ่ม</th><th>ผู้ติดต่อ</th><th className="n">โต๊ะ</th><th className="n">คน</th><th className="n">มาแล้ว</th><th>สถานะ</th><th /></tr></thead>
          <tbody>
            {!rows && <tr><td colSpan={8} className="muted">กำลังโหลด…</td></tr>}
            {rows && shown.length === 0 && <tr><td colSpan={8} className="muted">ไม่มีรายการ</td></tr>}
            {shown.map((r) => (
              <tr key={r.booking_id}>
                <td className="mono">{r.code}</td>
                <td>{r.group_name}</td>
                <td>{r.contact_name}<br /><span className="muted">{r.phone}</span></td>
                <td className="n">{pad2(r.table_no)}</td>
                <td className="n">{r.seat_count}</td>
                <td className="n">{r.checked_in}</td>
                <td><StatusPill payment={r.payment_status} status={r.status} /></td>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                    {r.status === 'active' && r.payment_status === 'pending' && (
                      <button className="btn sm accent" type="button" onClick={() => act('approve_payment', r.booking_id, `${r.code} ชำระแล้ว · QR เปิดใช้งาน`)}>ยืนยันชำระ</button>
                    )}
                    {r.status === 'active' && (confirmCancel === r.booking_id ? (
                      <>
                        <button className="btn sm" style={{ background: 'var(--bad)' }} type="button" onClick={() => act('cancel_booking', r.booking_id, `ยกเลิก ${r.code} แล้ว`)}>ยืนยันยกเลิก</button>
                        <button className="btn sm ghost" type="button" onClick={() => setConfirmCancel(null)}>ไม่</button>
                      </>
                    ) : (
                      <button className="btn sm ghost" type="button" onClick={() => setConfirmCancel(r.booking_id)}>ยกเลิก</button>
                    ))}
                    <Link className="btn sm ghost" href={`/ticket/${r.booking_id}`}>ตั๋ว</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function BookingsPage() {
  return <RequireStaff><Bookings /></RequireStaff>;
}
