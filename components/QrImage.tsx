'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrImage({ value, locked }: { value: string | null; locked: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!value) { setSrc(null); return; }
    QRCode.toDataURL(value, { width: 400, margin: 1, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => setSrc(null));
  }, [value]);

  return (
    <div className={`qrwrap ${locked ? 'locked' : ''}`}>
      {src ? <img src={src} alt="Group QR" /> : <div className="qrph" />}
      {locked && (
        <div className="lock"><span>QR ยังไม่เปิดใช้งาน<br />รอยืนยันการชำระเงิน</span></div>
      )}
    </div>
  );
}
