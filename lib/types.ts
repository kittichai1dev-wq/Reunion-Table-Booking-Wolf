export type PaymentStatus = 'pending' | 'paid';
export type BookingStatus = 'active' | 'cancelled';

export interface EventInfo {
  id: string;
  name: string;
  school: string | null;
  event_date: string;
  venue: string | null;
  price_per_seat: number;
}

export interface TableRow {
  table_id: string;
  table_no: number;
  capacity: number;
  booked: number;
  remaining: number;
}

export interface Ticket {
  code: string;
  group_name: string;
  table_no: number;
  seat_count: number;
  payment_status: PaymentStatus;
  status: BookingStatus;
  checked_in: number;
  remaining: number;
  qr_token: string | null;
}

export interface GroupSummary {
  booking_id: string;
  code: string;
  event_id: string;
  group_name: string;
  contact_name: string;
  phone: string;
  table_no: number;
  seat_count: number;
  payment_status: PaymentStatus;
  status: BookingStatus;
  checked_in: number;
  remaining: number;
  created_at: string;
  paid_at: string | null;
}

export interface TableSummary {
  event_id: string;
  table_no: number;
  capacity: number;
  booked_seats: number;
  remaining_seats: number;
  group_count: number;
}

export interface DashboardKpi {
  event_id: string;
  name: string;
  tables_total: number;
  tables_booked: number;
  seats_booked: number;
  checked_in: number;
  not_arrived: number;
  pending_groups: number;
  generated_at: string;
}

export interface CheckinLog {
  id: number;
  booking_id: string;
  staff_id: string | null;
  checked_in_at: string;
  request_id: string;
}

export type ResolveResult =
  | { ok: false; code: string }
  | {
      ok: true;
      booking_id: string;
      code: string;
      group_name: string;
      table_no: number;
      total: number;
      used: number;
      remaining: number;
      payment_status: PaymentStatus;
      status: BookingStatus;
    };

export interface ConfirmResult {
  ok: boolean;
  code?: string;
  used?: number;
  remaining?: number;
}
