'use client';
import { useState } from 'react';
import { exportExcel } from '@/lib/export-excel';

export default function ExportButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run() {
    setBusy(true);
    setError('');
    try { await exportExcel(); } catch (e) { setError('Export ไม่สำเร็จ: ' + (e as Error).message); }
    setBusy(false);
  }

  return (
    <>
      <button className="btn accent sm" type="button" onClick={run} disabled={busy}>{busy ? 'กำลังสร้างไฟล์…' : 'Export Excel'}</button>
      {error && <span className="msg bad">{error}</span>}
    </>
  );
}
