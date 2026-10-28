'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { rpc } from '@/lib/supabase';
import { pad2 } from '@/lib/format';
import type { TableRow } from '@/lib/types';

export default function TablesPage() {
  const [tables, setTables] = useState<TableRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    rpc<TableRow[]>('get_tables').then(setTables).catch((e: Error) => setError(e.message));
  }, []);

  return (
    <>
      <span className="sid">S02 · Guest</span>
      <div className="stack" style={{ gap: 4 }}>
        <h2>เลือกโต๊ะ</h2>
        <p className="muted">โต๊ะละ 10 ที่นั่ง หลาย Group จองโต๊ะเดียวกันได้ จนกว่าที่นั่งรวมจะเต็ม</p>
      </div>
      {error && <div className="msg bad">โหลดข้อมูลไม่สำเร็จ: {error}</div>}
      {!tables && !error && <p className="muted">กำลังโหลด…</p>}
      {tables && (
        <div className="tgrid">
          {tables.map((t) => {
            const inner = (
              <>
                <span className="tno">โต๊ะ {pad2(t.table_no)}</span>
                <span className="seats">
                  {Array.from({ length: t.capacity }, (_, i) => <i key={i} className={i < t.booked ? 'on' : ''} />)}
                </span>
                <span className="left num">{t.remaining <= 0 ? 'เต็มแล้ว' : `ว่าง ${t.remaining} / ${t.capacity} ที่`}</span>
              </>
            );
            return t.remaining <= 0 ? (
              <div key={t.table_id} className="tile full" aria-disabled="true">{inner}</div>
            ) : (
              <Link key={t.table_id} className="tile" href={`/book/${t.table_id}`}>{inner}</Link>
            );
          })}
        </div>
      )}
    </>
  );
}
