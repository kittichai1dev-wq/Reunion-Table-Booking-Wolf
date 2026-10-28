import { STATUS_LABEL, statusKey } from '@/lib/format';
import type { BookingStatus, PaymentStatus } from '@/lib/types';

export default function StatusPill({ payment, status, free = false }: { payment: PaymentStatus; status: BookingStatus; free?: boolean }) {
  const k = statusKey(payment, status, free);
  return <span className={`pill ${k}`}>{STATUS_LABEL[k]}</span>;
}
