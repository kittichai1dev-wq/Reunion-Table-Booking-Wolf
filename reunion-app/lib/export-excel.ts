import { sb } from './supabase';
import { STATUS_LABEL, dateTime, statusKey } from './format';
import type { CheckinLog, DashboardKpi, GroupSummary, TableSummary } from './types';

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// Builds the 5-sheet summary workbook in the browser and downloads it
export async function exportExcel() {
  const db = sb();
  const [kpi, groups, tables, logs, event] = await Promise.all([
    must<DashboardKpi | null>(db.from('v_dashboard').select('*').limit(1).maybeSingle()),
    must<GroupSummary[]>(db.from('v_group_summary').select('*').order('code')),
    must<TableSummary[]>(db.from('v_table_summary').select('*').order('table_no')),
    must<CheckinLog[]>(db.from('checkin_logs').select('*').order('checked_in_at')),
    must<{ price_per_seat: number } | null>(db.from('events').select('price_per_seat').limit(1).maybeSingle()),
  ]);
  const price = event?.price_per_seat ?? 0;
  const byId = new Map(groups.map((g) => [g.booking_id, g]));

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Reunion Table Booking';
  wb.created = new Date();

  const sheet = (name: string, columns: { header: string; key: string; width: number }[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns;
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D5C45' } };
    return ws;
  };

  // 1) สรุป
  const s = sheet('สรุป', [{ header: 'รายการ', key: 'k', width: 34 }, { header: 'ค่า', key: 'v', width: 26 }]);
  const paidSeats = groups.filter((g) => g.status === 'active' && g.payment_status === 'paid').reduce((a, g) => a + g.seat_count, 0);
  s.addRows([
    { k: 'งาน', v: kpi?.name ?? '' },
    { k: 'เวลาที่สร้างไฟล์', v: dateTime(new Date().toISOString()) },
    { k: 'โต๊ะทั้งหมด', v: kpi?.tables_total ?? 0 },
    { k: 'โต๊ะที่มีการจอง', v: kpi?.tables_booked ?? 0 },
    { k: 'ที่นั่งที่จอง (ไม่รวมยกเลิก)', v: kpi?.seats_booked ?? 0 },
    { k: 'ที่นั่งที่ชำระแล้ว', v: paidSeats },
    { k: 'เข้างานแล้ว (จาก Check-in Log)', v: kpi?.checked_in ?? 0 },
    { k: 'ยังไม่มา (สิทธิ์ที่ชำระแล้ว)', v: kpi?.not_arrived ?? 0 },
    { k: 'กลุ่มที่รอยืนยันชำระ', v: kpi?.pending_groups ?? 0 },
    { k: 'ยอดเงินที่ชำระแล้ว (บาท)', v: paidSeats * price },
  ]);
  s.getColumn('v').alignment = { horizontal: 'left' };

  // 2) ราย Group
  const g = sheet('ราย Group', [
    { header: 'เลข Booking', key: 'code', width: 12 },
    { header: 'กลุ่ม', key: 'group', width: 30 },
    { header: 'โต๊ะ', key: 'table', width: 8 },
    { header: 'สิทธิ์', key: 'seats', width: 8 },
    { header: 'มาแล้ว', key: 'in', width: 8 },
    { header: 'ยังไม่มา', key: 'rem', width: 9 },
    { header: 'สถานะ', key: 'st', width: 12 },
  ]);
  groups.forEach((x) => g.addRow({ code: x.code, group: x.group_name, table: x.table_no, seats: x.seat_count, in: x.checked_in, rem: x.remaining, st: STATUS_LABEL[statusKey(x.payment_status, x.status)] }));

  // 3) รายโต๊ะ
  const t = sheet('รายโต๊ะ', [
    { header: 'โต๊ะ', key: 'no', width: 8 },
    { header: 'ความจุ', key: 'cap', width: 9 },
    { header: 'จองแล้ว', key: 'booked', width: 9 },
    { header: 'ว่าง', key: 'left', width: 8 },
    { header: 'จำนวนกลุ่ม', key: 'groups', width: 11 },
  ]);
  tables.forEach((x) => t.addRow({ no: x.table_no, cap: x.capacity, booked: x.booked_seats, left: x.remaining_seats, groups: x.group_count }));

  // 4) รายการจอง (มีข้อมูลติดต่อ)
  const b = sheet('รายการจอง', [
    { header: 'เลข Booking', key: 'code', width: 12 },
    { header: 'กลุ่ม', key: 'group', width: 30 },
    { header: 'ผู้ติดต่อ', key: 'contact', width: 22 },
    { header: 'โทรศัพท์', key: 'phone', width: 14 },
    { header: 'โต๊ะ', key: 'table', width: 8 },
    { header: 'ที่นั่ง', key: 'seats', width: 8 },
    { header: 'ยอดเงิน (บาท)', key: 'amount', width: 14 },
    { header: 'สถานะ', key: 'st', width: 12 },
    { header: 'จองเมื่อ', key: 'created', width: 22 },
    { header: 'ชำระเมื่อ', key: 'paid', width: 22 },
  ]);
  groups.forEach((x) => b.addRow({
    code: x.code, group: x.group_name, contact: x.contact_name, phone: x.phone, table: x.table_no, seats: x.seat_count,
    amount: x.seat_count * price, st: STATUS_LABEL[statusKey(x.payment_status, x.status)], created: dateTime(x.created_at), paid: dateTime(x.paid_at),
  }));
  b.getColumn('amount').numFmt = '#,##0';

  // 5) Check-in Log
  const l = sheet('Check-in Log', [
    { header: 'ลำดับ', key: 'n', width: 7 },
    { header: 'เวลา', key: 'at', width: 22 },
    { header: 'เลข Booking', key: 'code', width: 12 },
    { header: 'กลุ่ม', key: 'group', width: 30 },
    { header: 'Staff ID', key: 'staff', width: 38 },
    { header: 'Request ID', key: 'req', width: 38 },
  ]);
  logs.forEach((x, i) => {
    const grp = byId.get(x.booking_id);
    l.addRow({ n: i + 1, at: dateTime(x.checked_in_at), code: grp?.code ?? '', group: grp?.group_name ?? '', staff: x.staff_id ?? '', req: x.request_id });
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `reunion-summary-${stamp}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
