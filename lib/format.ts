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

export function statusKey(payment: PaymentStatus, status: BookingStatus) {
  return status === 'cancelled' ? 'cancelled' : payment;
}
export const STATUS_LABEL: Record<string, string> = { paid: 'Paid', pending: 'Pending', cancelled: 'Cancelled' };

export const ERROR_TEXT: Record<string, string> = {
  TABLE_FULL: 'โต๊ะนี้ที่นั่งไม่พอ',
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
