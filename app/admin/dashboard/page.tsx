'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/supabase';
import { baht, clock, dateTime, pad2 } from '@/lib/format';
import type { CheckinLog, DashboardKpi, GroupSummary, TableSummary } from '@/lib/types';
import RequireStaff from '@/components/RequireStaff';
import StatusPill from '@/components/StatusPill';
import ExportButton from '@/components/ExportButton';

const REFRESH_MS = 5 * 60 * 1000;

function Dashboard() {
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [logs, setLogs] = useState<CheckinLog[]>([]);
  const [updatedAt, setUpdatedAt] = useState('');
  const [live, setLive] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const db = sb();
    const [k, g, t, l] = await Promise.all([
      db.from('v_dashboard').select('*').limit(1).maybeSingle(),
      db.from('v_group_summary').select('*').eq('status', 'active').order('class_no').order('code'),
      db.from('v_table_summary').select('*').order('table_no'),
      db.from('checkin_logs').select('*').order('checked_in_at', { ascending: false }).limit(10),
    ]);
    const err = k.error ?? g.error ?? t.error ?? l.error;
    if (err) { setError(err.message); return; }
    setError('');
    setKpi(k.data as DashboardKpi | null);
    setGroups((g.data ?? []) as GroupSummary[]);
    setTables((t.data ?? []) as TableSummary[]);
    setLogs((l.data ?? []) as CheckinLog[]);
    setUpdatedAt(clock());
  }, []);

  useEffect(() => {
    load();
    const every5 = setInterval(load, REFRESH_MS);
    // Realtime: reload shortly after a new check-in (batched so a rush doesn't spam queries)
    const channel = sb()
      .channel('checkins')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'checkin_logs' }, () => {
        if (pending.current) return;
        pending.current = setTimeout(() => { pending.current = null; load(); }, 1500);
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      clearInterval(every5);
      if (pending.current) clearTimeout(pending.current);
      sb().removeChannel(channel);
    };
  }, [load]);

  const byId = new Map(groups.map((g) => [g.booking_id, g]));

  return (
    <>
      <span className="sid">S07 · Admin</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>Dashboard</h2>
        <p className="muted">ยอดเข้างานนับจาก Check-in Log ที่สำเร็จ ไม่ใช่จำนวนครั้งที่อ่าน QR</p>
      </div>
      <div className="row between">
        <span className={`live ${live ? 'on' : ''}`}><i />{live ? 'Realtime' : 'อัปเดตทุก 5 นาที'} · ล่าสุด {updatedAt || '…'}</span>
        <div className="row">
          <button className="btn ghost sm" type="button" onClick={load}>Refresh</button>
          <ExportButton />
        </div>
      </div>
      {error && <div className="msg bad">โหลดข้อมูลไม่สำเร็จ: {error}</div>}

      {kpi && (
        <div className="stats">
          <div className="stat"><div className="v">{kpi.tables_booked}<small> / {kpi.tables_total}</small></div><div className="k">โต๊ะที่มีการจอง</div></div>
          <div className="stat"><div className="v">{kpi.seats_booked}<small> / {kpi.seats_total}</small></div><div className="k">ที่นั่งที่จอง ({groups.length} กลุ่ม)</div></div>
          <div className="stat"><div className="v" style={{ color: 'var(--ok)' }}>{kpi.checked_in}</div><div className="k">เข้างานแล้ว</div></div>
          <div className="stat"><div className="v">{kpi.not_arrived}</div><div className="k">ยังไม่มา (สิทธิ์ที่ชำระแล้ว)</div></div>
          <div className="stat"><div className="v" style={{ color: 'var(--warn)' }}>{kpi.slips_waiting}<small> / {kpi.pending_groups}</small></div><div className="k">สลิปรอตรวจ / กลุ่มรอชำระ</div></div>
          <div className="stat"><div className="v">{kpi.unassigned_groups}</div><div className="k">กลุ่มที่ยังไม่จัดโต๊ะ</div></div>
          <div className="stat"><div className="v">{baht(kpi.paid_amount)}</div><div className="k">ยอดเงินที่ยืนยันแล้ว</div></div>
        </div>
      )}

      <div className="stack" style={{ gap: 8 }}>
        <div className="row between"><h3>สรุปราย Group</h3><Link className="btn ghost sm" href="/admin/bookings">จัดการรายการจอง</Link></div>
        <div className="tablewrap">
          <table>
            <thead><tr><th className="n">รุ่น</th><th>กลุ่ม</th><th className="n">โต๊ะ</th><th className="n">สิทธิ์</th><th className="n">มาแล้ว</th><th className="n">เหลือ</th><th /><th>สถานะ</th></tr></thead>
            <tbody>
              {groups.length === 0 && <tr><td colSpan={8} className="muted">ยังไม่มีการจอง</td></tr>}
              {groups.map((g) => (
                <tr key={g.booking_id}>
                  <td className="n">{g.class_no ?? '-'}</td>
                  <td>{g.group_name}</td>
                  <td className="n">{g.table_no == null ? <span className="muted">-</span> : pad2(g.table_no)}</td>
                  <td className="n">{g.seat_count}</td>
                  <td className="n">{g.checked_in}</td>
                  <td className="n">{g.remaining}</td>
                  <td><span className="minibar"><i style={{ width: `${(g.checked_in / g.seat_count) * 100}%` }} /></span></td>
                  <td><StatusPill payment={g.payment_status} status={g.status} free={g.is_free} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card stack">
        <h3>ผังโต๊ะ (ที่นั่งที่จอง)</h3>
        <div className="tmap num">
          {tables.map((t) => (
            <div key={t.table_no} className="tm" title={`โต๊ะ ${pad2(t.table_no)}: ${t.booked_seats}/${t.capacity}`}>
              <i className="f" style={{ height: `${(t.booked_seats / t.capacity) * 100}%` }} />
              <span><b>{pad2(t.table_no)}</b>{t.booked_seats}/{t.capacity}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h3>Check-in Log ล่าสุด</h3>
        {logs.length === 0 ? <p className="muted">ยังไม่มีการเช็กอิน</p> : (
          <ul className="log">
            {logs.map((l) => (
              <li key={l.id}><span>{byId.get(l.booking_id)?.group_name ?? '-'} · +1</span><span className="muted num">{dateTime(l.checked_in_at)}</span></li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  return <RequireStaff><Dashboard /></RequireStaff>;
}
