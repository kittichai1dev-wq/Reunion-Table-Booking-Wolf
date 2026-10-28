'use client';
import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';

const READER_ID = 'qr-reader';

// Reading a QR only reports the token; check-in happens when staff press Confirm
export default function QrScanner({ onScan }: { onScan: (token: string) => void }) {
  const scanner = useRef<Html5Qrcode | null>(null);
  const onScanRef = useRef(onScan);
  const last = useRef({ text: '', at: 0 });
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  onScanRef.current = onScan;

  async function start() {
    setError('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const s = new Html5Qrcode(READER_ID);
      scanner.current = s;
      await s.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text) => {
          // the camera keeps seeing the same code; report it once per 2.5 s
          const now = Date.now();
          if (text === last.current.text && now - last.current.at < 2500) return;
          last.current = { text, at: now };
          onScanRef.current(text);
        },
        () => {},
      );
      setRunning(true);
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      setError(
        /secure|https/i.test(m) ? 'เปิดกล้องได้เฉพาะบน HTTPS หรือ localhost'
        : /permission|notallowed/i.test(m) ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง เปิดสิทธิ์กล้องในการตั้งค่าเบราว์เซอร์'
        : 'เปิดกล้องไม่สำเร็จ: ' + m,
      );
    }
  }

  async function stop() {
    try { await scanner.current?.stop(); scanner.current?.clear(); } catch {}
    scanner.current = null;
    setRunning(false);
  }

  useEffect(() => () => { scanner.current?.stop().catch(() => {}); }, []);

  return (
    <div className="stack">
      <div id={READER_ID} className={`reader ${running ? '' : 'off'}`} />
      <div className="row">
        {running
          ? <button className="btn ghost" type="button" onClick={stop}>ปิดกล้อง</button>
          : <button className="btn" type="button" onClick={start}>เปิดกล้องสแกน QR</button>}
      </div>
      {error && <div className="msg bad">{error}</div>}
    </div>
  );
}
