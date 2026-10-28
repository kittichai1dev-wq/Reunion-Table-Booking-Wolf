'use client';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { baht, dateTime } from '@/lib/format';

export interface SlipTarget {
  code: string;
  group_name: string;
  amount: number;
  slip_path: string;
  slip_uploaded_at: string | null;
  canApprove: boolean;
}

// Staff-only modal; the bucket is private so the slip is shown through a 5-minute signed URL
export default function SlipPreview({ target, onClose, onApprove }: { target: SlipTarget; onClose: () => void; onApprove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const isPdf = target.slip_path.toLowerCase().endsWith('.pdf');

  useEffect(() => {
    sb().storage.from('slips').createSignedUrl(target.slip_path, 300).then(({ data, error }) => {
      if (error || !data) setError(error?.message ?? 'เปิดสลิปไม่ได้');
      else setUrl(data.signedUrl);
    });
  }, [target.slip_path]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`สลิปของ ${target.code}`} onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div>
            <h3>{target.group_name}</h3>
            <span className="muted"><span className="mono">{target.code}</span> · ยอดที่ต้องได้รับ <b>{baht(target.amount)}</b></span>
          </div>
          <button className="btn ghost sm" type="button" onClick={onClose}>ปิด</button>
        </div>
        <div className="slip-view">
          {error && <div className="msg bad">{error}</div>}
          {!url && !error && <p className="muted">กำลังโหลดสลิป…</p>}
          {url && (isPdf
            ? <a className="btn" href={url} target="_blank" rel="noreferrer">เปิดไฟล์ PDF</a>
            : <img src={url} alt={`สลิปของ ${target.code}`} />)}
        </div>
        <div className="row between">
          <span className="muted" style={{ fontSize: '.82rem' }}>แนบเมื่อ {dateTime(target.slip_uploaded_at)}</span>
          <div className="row">
            {url && <a className="btn ghost sm" href={url} target="_blank" rel="noreferrer">เปิดขนาดเต็ม</a>}
            {target.canApprove && onApprove && <button className="btn accent sm" type="button" onClick={onApprove}>ยอดถูกต้อง · ยืนยันชำระ</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
