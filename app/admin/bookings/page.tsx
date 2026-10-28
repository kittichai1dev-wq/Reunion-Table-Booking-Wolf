'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { rpc, sb } from '@/lib/supabase';
import { ERROR_TEXT, baht, pad2, statusKey } from '@/lib/format';
import type { GroupSummary, RpcResult, TableRow } from '@/lib/types';
import RequireStaff from '@/components/RequireStaff';
import StatusPill from '@/components/StatusPill';
import ExportButton from '@/components/ExportButton';
import EventSettings from '@/components/EventSettings';
import SlipPreview, { type SlipTarget } from '@/components/SlipPreview';

const FILTERS: { k: string; label: string; test: (r: GroupSummary) => boolean }[] = [
  { k: 'all', label: 'ทั้งหมด', test: () => true },
  { k: 'slip', label: 'สลิปรอตรวจ', test: (r) => r.status === 'active' && r.payment_status === 'pending' && !!r.slip_path },
  { k: 'pending', label: 'รอชำระ', test: (r) => statusKey(r.payment_status, r.status, r.is_free) === 'pending' },
  { k: 'paid', label: 'ชำระแล้ว', test: (r) => statusKey(r.payment_status, r.status, r.is_free) === 'paid' },
  { k: 'free', label: 'ไม่ต้องชำระ', test: (r) => statusKey(r.payment_status, r.status, r.is_free) === 'free' },
  { k: 'notable', label: 'ยังไม่จัดโต๊ะ', test: (r) => r.status === 'active' && !r.table_id },
  { k: 'cancelled', label: 'ยกเลิก', test: (r) => r.status === 'cancelled' },
];

function Bookings() {
  const [rows, setRows] = useState<GroupSummary[] | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [slip, setSlip] = useState<(SlipTarget & { id: string }) | null>(null);
  const [msg, setMsg] = useState<{ k: string; text: string } | null>(null);

  const load = useCallback(async () => {
    const [{ data, error }, t] = await Promise.all([
      sb().from('v_group_summary').select('*').order('code'),
      rpc<TableRow[]>('get_tables').catch(() => [] as TableRow[]),
    ]);
    if (error) { setMsg({ k: 'bad', text: error.message }); return; }
    setRows(data as GroupSummary[]);
    setTables(t);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function call(fn: string, args: Record<string, unknown>, done: string) {
    try {
      const r = await rpc<RpcResult>(fn, args);
      setMsg(r.ok ? { k: 'ok', text: done }
        : { k: 'bad', text: r.code === 'TABLE_FULL' ? `โต๊ะนี้เหลือ ${r.remaining ?? 0} ที่ ไม่พอสำหรับกลุ่มนี้` : ERROR_TEXT[r.code ?? ''] ?? String(r.code) });
    } catch (e) {
      setMsg({ k: 'bad', text: (e as Error).message });
    }
    setConfirmCancel(null);
    load();
  }

  const active = FILTERS.find((f) => f.k === filter)!;
  const shown = (rows ?? []).filter((r) =>
    active.test(r) &&
    (!q.trim() || `${r.code} ${r.class_no ?? ''} ${r.group_name} ${r.contact_name} ${r.phone}`.toLowerCase().includes(q.trim().toLowerCase())),
  );
  const count = (k: string) => (rows ?? []).filter(FILTERS.find((f) => f.k === k)!.test).length;

  return (
    <>
      <span className="sid">ADM · Admin</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>รายการจอง</h2>
        <p className="muted">ตรวจสลิป ยืนยันชำระ จัดโต๊ะ หรือยกเลิก Booking · การยกเลิกจะคืนที่นั่ง</p>
      </div>
      <EventSettings onSaved={load} />
      <div className="row between">
        <div className="tabs">
          {FILTERS.map((f) => (
            <button key={f.k} type="button" aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>
              {f.label}{f.k !== 'all' && rows ? ` (${count(f.k)})` : ''}
            </button>
          ))}
        </div>
        <ExportButton />
      </div>
      <div className="field">
        <input id="search" placeholder="ค้นหาเลข Booking รุ่น ชื่อกลุ่ม ผู้ติดต่อ หรือเบอร์โทร" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
      </div>
      {msg && <div className={`msg ${msg.k}`}>{msg.text}</div>}
      <div className="tablewrap">
        <table>
          <thead><tr><th>เลข</th><th className="n">รุ่น</th><th>กลุ่ม</th><th>ผู้ติดต่อ</th><th className="n">คน</th><th className="n">ยอด</th><th>สลิป</th><th>สถานะ</th><th>โต๊ะ</th><th /></tr></thead>
          <tbody>
            {!rows && <tr><td colSpan={10} className="muted">กำลังโหลด…</td></tr>}
            {rows && shown.length === 0 && <tr><td colSpan={10} className="muted">ไม่มีรายการ</td></tr>}
            {shown.map((r) => {
              const canApprove = r.status === 'active' && r.payment_status === 'pending';
              return (
                <tr key={r.booking_id}>
                  <td className="mono">{r.code}</td>
                  <td className="n">{r.class_no ?? '-'}</td>
                  <td>{r.group_name}</td>
                  <td>{r.contact_name}<br /><span className="muted">{r.phone}</span></td>
                  <td className="n">{r.seat_count}</td>
                  <td className="n">{r.is_free ? '-' : baht(r.amount)}</td>
                  <td>
                    {r.slip_path ? (
                      <button className="btn sm ghost" type="button" onClick={() => setSlip({
                        id: r.booking_id, code: r.code, group_name: r.group_name, amount: r.amount,
                        slip_path: r.slip_path!, slip_uploaded_at: r.slip_uploaded_at, canApprove,
                      })}>ดูสลิป</button>
                    ) : <span className="muted">{r.is_free ? '-' : 'ยังไม่แนบ'}</span>}
                  </td>
                  <td><StatusPill payment={r.payment_status} status={r.status} free={r.is_free} /></td>
                  <td>
                    {r.status === 'active' ? (
                      <select className="tsel" aria-label={`โต๊ะของ ${r.code}`} value={r.table_id ?? ''}
                        onChange={(e) => call('assign_table', { p_booking_id: r.booking_id, p_table_id: e.target.value || null },
                          e.target.value ? `จัด ${r.code} ไปโต๊ะ ${pad2(tables.find((t) => t.table_id === e.target.value)?.table_no ?? 0)} แล้ว` : `เอา ${r.code} ออกจากโต๊ะแล้ว`)}>
                        <option value="">รอจัดโต๊ะ</option>
                        {tables.map((t) => {
                          const fits = t.table_id === r.table_id || t.remaining >= r.seat_count;
                          return <option key={t.table_id} value={t.table_id} disabled={!fits}>โต๊ะ {pad2(t.table_no)} (ว่าง {t.remaining})</option>;
                        })}
                      </select>
                    ) : <span className="muted">-</span>}
                  </td>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
                      {canApprove && (
                        <button className="btn sm accent" type="button" onClick={() => call('approve_payment', { p_booking_id: r.booking_id }, `${r.code} ชำระแล้ว · QR เปิดใช้งาน`)}>ยืนยันชำระ</button>
                      )}
                      {r.status === 'active' && (confirmCancel === r.booking_id ? (
                        <>
                          <button className="btn sm danger" type="button" onClick={() => call('cancel_booking', { p_booking_id: r.booking_id }, `ยกเลิก ${r.code} แล้ว`)}>ยืนยันยกเลิก</button>
                          <button className="btn sm ghost" type="button" onClick={() => setConfirmCancel(null)}>ไม่</button>
                        </>
                      ) : (
                        <button className="btn sm ghost" type="button" onClick={() => setConfirmCancel(r.booking_id)}>ยกเลิก</button>
                      ))}
                      <Link className="btn sm ghost" href={`/ticket/${r.booking_id}`}>ตั๋ว</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {slip && (
        <SlipPreview
          target={slip}
          onClose={() => setSlip(null)}
          onApprove={() => { const id = slip.id, code = slip.code; setSlip(null); call('approve_payment', { p_booking_id: id }, `${code} ชำระแล้ว · QR เปิดใช้งาน`); }}
        />
      )}
    </>
  );
}

export default function BookingsPage() {
  return <RequireStaff><Bookings /></RequireStaff>;
}
