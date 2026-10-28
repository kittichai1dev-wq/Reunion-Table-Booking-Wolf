import type { BookingStatus, PaymentStatus } from './types';

const TZ = 'Asia/Bangkok';

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const baht = (n: number) => '฿' + n.toLocaleString('th-TH');

export function eventDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date(iso));
}
export function timeOf(iso: string) {
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso)) + ' น.';
}
export function dateTime(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ }).format(new Date(iso));
}
export function clock(d = new Date()) {
  return new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ }).format(d);
}

export function statusKey(payment: PaymentStatus, status: BookingStatus, isFree = false) {
  if (status === 'cancelled') return 'cancelled';
  return isFree ? 'free' : payment;
}
export const STATUS_LABEL: Record<string, string> = { paid: 'Paid', pending: 'Pending', cancelled: 'Cancelled', free: 'ไม่ต้องชำระ' };

export const tableLabel = (no: number | null) => (no == null ? 'รอจัดโต๊ะ' : `โต๊ะ ${pad2(no)}`);
export const isFreeClass = (cls: number | null, from: number | null, to: number | null) =>
  cls != null && from != null && to != null && cls >= from && cls <= to;

export const ERROR_TEXT: Record<string, string> = {
  TABLE_FULL: 'โต๊ะนี้ที่นั่งไม่พอ',
  EVENT_FULL: 'ที่นั่งของงานเต็มแล้ว',
  INVALID_CLASS: 'เลือกรุ่นให้ถูกต้อง',
  NO_EVENT: 'ยังไม่มีงานที่เปิดรับจอง',
  INVALID_PATH: 'ไฟล์สลิปไม่ถูกต้อง',
  NOT_PENDING: 'Booking นี้ไม่ได้อยู่ในสถานะรอชำระ',
  INVALID_RANGE: 'ช่วงรุ่นไม่ถูกต้อง ต้องกรอกทั้งสองช่อง และรุ่นเริ่มต้องไม่มากกว่ารุ่นสุดท้าย',
  TABLE_NOT_FOUND: 'ไม่พบโต๊ะนี้',
  INVALID_SEATS: 'จำนวนคนต้องอย่างน้อย 1',
  MISSING_FIELDS: 'กรอกข้อมูลให้ครบ',
  NOT_FOUND: 'ไม่พบ QR นี้ในระบบ',
  NOT_FOUND_OR_CANCELLED: 'ไม่พบ Booking หรือถูกยกเลิกแล้ว',
  NOT_PAID: 'ปฏิเสธ: ยังไม่ชำระเงิน',
  CANCELLED: 'ปฏิเสธ: Booking ถูกยกเลิก',
  QUOTA_FULL: 'ปฏิเสธ: สิทธิ์ครบแล้ว ห้ามเพิ่ม',
  DUPLICATE: 'requestId ซ้ำ · บันทึกไปแล้ว ไม่เพิ่มยอด',
};

export function newRequestId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'req-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const MY_KEY = 'my-bookings';
export function rememberBooking(id: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(MY_KEY) || '[]');
    if (!list.includes(id)) localStorage.setItem(MY_KEY, JSON.stringify([id, ...list].slice(0, 10)));
  } catch {}
}
export function myBookings(): string[] {
  try { return JSON.parse(localStorage.getItem(MY_KEY) || '[]'); } catch { return []; }
}
