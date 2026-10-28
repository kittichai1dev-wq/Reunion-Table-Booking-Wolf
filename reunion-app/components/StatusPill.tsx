import { STATUS_LABEL, statusKey } from '@/lib/format';
import type { BookingStatus, PaymentStatus } from '@/lib/types';

export default function StatusPill({ payment, status }: { payment: PaymentStatus; status: BookingStatus }) {
  const k = statusKey(payment, status);
  return <span className={`pill ${k}`}>{STATUS_LABEL[k]}</span>;
}
