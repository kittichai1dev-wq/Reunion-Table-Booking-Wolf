'use client';
import { useState, type FormEvent } from 'react';
import { rpc } from '@/lib/supabase';
import { ERROR_TEXT, newRequestId, pad2 } from '@/lib/format';
import type { ConfirmResult, ResolveResult } from '@/lib/types';
import RequireStaff from '@/components/RequireStaff';
import StatusPill from '@/components/StatusPill';
import QrScanner from '@/components/QrScanner';

interface ScanState {
  token: string;
  info: ResolveResult;
  requestId: string;     // used by the next Confirm press
  lastRequestId: string | null;
  msg: { k: 'ok' | 'warn' | 'bad'; text: string } | null;
}

function CheckinScreen() {
  const [scan, setScan] = useState<ScanState | null>(null);
  const [manual, setManual] = useState('');
  const [busy, setBusy] = useState(false);

  async function resolve(token: string, msg: ScanState['msg'], keep?: Pick<ScanState, 'requestId' | 'lastRequestId'>) {
    const info = await rpc<ResolveResult>('resolve_checkin', { p_token: token.trim() });
    setScan({ token: token.trim(), info, requestId: keep?.requestId ?? newRequestId(), lastRequestId: keep?.lastRequestId ?? null, msg });
  }

  async function onScan(token: string) {
    try {
      await resolve(token, { k: 'ok', text: 'อ่าน QR แล้ว · ยังไม่นับเช็กอินจนกว่าจะกด Confirm' });
    } catch (e) {
      setScan(null);
      alertError((e as Error).message);
    }
  }
  const [err, setErr] = useState('');
  function alertError(m: string) { setErr(m); setTimeout(() => setErr(''), 4000); }

  async function confirm(requestId: string, isResend: boolean) {
    if (!scan) return;
    setBusy(true);
    try {
      const r = await rpc<ConfirmResult>('confirm_checkin', { p_token: scan.token, p_request_id: requestId });
      let msg: ScanState['msg'];
      let keep = { requestId: scan.requestId, lastRequestId: scan.lastRequestId };
      if (r.ok) {
        msg = { k: 'ok', text: `เช็กอินสำเร็จ +1 คน · ใช้แล้ว ${r.used} คงเหลือ ${r.remaining}` };
        keep = { requestId: newRequestId(), lastRequestId: requestId };
      } else if (r.code === 'DUPLICATE') {
        msg = { k: 'warn', text: isResend ? 'ส่งซ้ำด้วย requestId เดิม · ระบบรู้ว่าบันทึกไปแล้ว ไม่เพิ่มยอด' : ERROR_TEXT.DUPLICATE };
      } else {
        msg = { k: 'bad', text: ERROR_TEXT[r.code ?? ''] ?? String(r.code) };
      }
      await resolve(scan.token, msg, keep);
    } catch (e) {
      alertError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitManual(e: FormEvent) {
    e.preventDefault();
    if (manual.trim()) onScan(manual);
  }

  const info = scan?.info;
  const cls = info && info.ok ? (info.status === 'cancelled' ? 'bad' : info.payment_status === 'paid' ? '' : 'warn') : 'bad';

  return (
    <>
      <span className="sid">S06 · Staff</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>สแกนเช็กอิน</h2>
        <p className="muted">กล้องอ่าน QR ได้ไม่เท่ากับเช็กอินสำเร็จ เจ้าหน้าที่ต้องกด Confirm 1 ครั้งต่อ 1 คน</p>
      </div>

      <section className="scanner">
        <QrScanner onScan={onScan} />
        <form className="row nowrap" onSubmit={submitManual}>
          <input id="manual-token" placeholder="หรือพิมพ์ Token เช่น RTB-…" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="QR Token" />
          <button className="btn ghost" type="submit">อ่าน</button>
        </form>
      </section>

      {err && <div className="msg bad">{err}</div>}

      {!scan && <div className="card empty"><p>สแกน QR ของแขกเพื่อดูสิทธิ์คงเหลือ</p></div>}

      {scan && info && !info.ok && (
        <div className="result bad"><h3>ไม่พบ QR นี้ในระบบ</h3><p>ตรวจว่าเป็น QR ของงานนี้ หรือให้แขกเปิดตั๋วใหม่อีกครั้ง</p></div>
      )}

      {scan && info && info.ok && (
        <div className={`result ${cls}`}>
          <div className="row between">
            <div><h3>{info.group_name}</h3><span className="muted">{info.code} · โต๊ะ {pad2(info.table_no)}</span></div>
            <StatusPill payment={info.payment_status} status={info.status} />
          </div>
          <div className="trio">
            <div><div className="v">{info.total}</div><div className="k">สิทธิ์รวม</div></div>
            <div><div className="v">{info.used}</div><div className="k">ใช้แล้ว</div></div>
            <div className="rem"><div className="v">{info.remaining}</div><div className="k">คงเหลือ</div></div>
          </div>
          {scan.msg && <div className={`msg ${scan.msg.k}`}>{scan.msg.text}</div>}
          {info.status === 'active' && info.payment_status === 'pending' && <div className="msg warn">ยังไม่ชำระเงิน เช็กอินไม่ได้</div>}
          {info.status === 'cancelled' && <div className="msg bad">Booking ถูกยกเลิก เช็กอินไม่ได้</div>}
          <button className="btn big" type="button" disabled={busy || info.payment_status !== 'paid' || info.status !== 'active'} onClick={() => confirm(scan.requestId, false)}>
            {busy ? 'กำลังบันทึก…' : info.remaining <= 0 ? 'สิทธิ์ครบแล้ว · ลอง Confirm' : 'Confirm +1 คน'}
          </button>
          <div className="row">
            <button className="btn ghost sm" type="button" onClick={() => onScan(scan.token)}>อ่าน QR ซ้ำ</button>
            <button className="btn ghost sm" type="button" disabled={!scan.lastRequestId || busy} onClick={() => scan.lastRequestId && confirm(scan.lastRequestId, true)}>
              ส่งซ้ำด้วย requestId เดิม
            </button>
          </div>
          <p className="req mono">requestId ถัดไป: {scan.requestId}</p>
        </div>
      )}
    </>
  );
}

export default function CheckinPage() {
  return <RequireStaff><CheckinScreen /></RequireStaff>;
}
