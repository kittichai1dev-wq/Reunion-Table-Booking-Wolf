'use client';
import { useEffect, useState } from 'react';
import { rpc, sb } from '@/lib/supabase';
import { ERROR_TEXT } from '@/lib/format';
import type { RpcResult } from '@/lib/types';

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

export default function SlipUpload({ bookingId, hasSlip, onDone }: { bookingId: string; hasSlip: boolean; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ k: string; text: string } | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(f: File | null) {
    setMsg(null);
    if (!f) { setFile(null); return; }
    if (!TYPES.includes(f.type)) { setMsg({ k: 'bad', text: 'รองรับไฟล์ JPG, PNG, WEBP, HEIC หรือ PDF เท่านั้น' }); return; }
    if (f.size > MAX_BYTES) { setMsg({ k: 'bad', text: 'ไฟล์ใหญ่เกิน 5 MB ลองถ่ายหน้าจอสลิปใหม่' }); return; }
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${bookingId}/${Date.now()}.${ext}`;
    const { error } = await sb().storage.from('slips').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setBusy(false); setMsg({ k: 'bad', text: 'อัปโหลดไม่สำเร็จ: ' + error.message }); return; }
    try {
      const r = await rpc<RpcResult>('attach_slip', { p_booking_id: bookingId, p_path: path });
      if (!r.ok) setMsg({ k: 'bad', text: ERROR_TEXT[r.code ?? ''] ?? String(r.code) });
      else { setMsg({ k: 'ok', text: 'แนบสลิปแล้ว รอเจ้าหน้าที่ตรวจสอบ' }); setFile(null); onDone(); }
    } catch (e) {
      setMsg({ k: 'bad', text: (e as Error).message });
    }
    setBusy(false);
  }

  return (
    <div className="card stack">
      <h3>{hasSlip ? 'แนบสลิปใหม่ (ถ้าแนบผิด)' : 'แนบสลิปการโอนเงิน'}</h3>
      <label className="drop" htmlFor="slip-file">
        {preview ? <img src={preview} alt="ตัวอย่างสลิป" /> : <span>{file ? file.name : 'แตะเพื่อเลือกรูปสลิป หรือไฟล์ PDF'}</span>}
        <small className="muted">JPG / PNG / HEIC / PDF ไม่เกิน 5 MB</small>
      </label>
      <input id="slip-file" type="file" accept="image/*,application/pdf" hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      {msg && <div className={`msg ${msg.k}`}>{msg.text}</div>}
      <button className="btn big" type="button" disabled={!file || busy} onClick={upload}>{busy ? 'กำลังอัปโหลด…' : 'ส่งสลิป'}</button>
    </div>
  );
}
