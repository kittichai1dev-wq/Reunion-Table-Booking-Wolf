export type PaymentStatus = 'pending' | 'paid';
export type BookingStatus = 'active' | 'cancelled';

export interface EventInfo {
  id: string;
  name: string;
  school: string | null;
  event_date: string;
  venue: string | null;
  price_per_seat: number;
  class_min: number;
  class_max: number;
  free_class_from: number | null;
  free_class_to: number | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
  seats_total: number;
  seats_booked: number;
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
  class_no: number | null;
  group_name: string;
  table_no: number | null;
  seat_count: number;
  amount: number;
  is_free: boolean;
  payment_status: PaymentStatus;
  status: BookingStatus;
  checked_in: number;
  remaining: number;
  has_slip: boolean;
  slip_uploaded_at: string | null;
  qr_token: string | null;
}

export interface GroupSummary {
  booking_id: string;
  code: string;
  event_id: string;
  class_no: number | null;
  group_name: string;
  contact_name: string;
  phone: string;
  table_id: string | null;
  table_no: number | null;
  seat_count: number;
  amount: number;
  is_free: boolean;
  payment_status: PaymentStatus;
  status: BookingStatus;
  slip_path: string | null;
  slip_uploaded_at: string | null;
  checked_in: number;
  remaining: number;
  created_at: string;
  paid_at: string | null;
}

export interface TableSummary {
  table_id: string;
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
  seats_total: number;
  seats_booked: number;
  checked_in: number;
  not_arrived: number;
  pending_groups: number;
  slips_waiting: number;
  unassigned_groups: number;
  paid_amount: number;
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
      class_no: number | null;
      group_name: string;
      table_no: number | null;
      total: number;
      used: number;
      remaining: number;
      payment_status: PaymentStatus;
      status: BookingStatus;
      is_free: boolean;
    };

export interface ConfirmResult {
  ok: boolean;
  code?: string;
  used?: number;
  remaining?: number;
}

export interface RpcResult {
  ok: boolean;
  code?: string;
  remaining?: number;
}
