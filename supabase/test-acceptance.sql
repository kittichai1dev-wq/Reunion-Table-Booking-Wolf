-- ทดสอบ Acceptance Criteria (เอกสารข้อ 10) หลังรัน schema.sql แล้ว
-- รันทีละบรรทัดใน SQL Editor แล้วดูผลลัพธ์ที่คอมเมนต์ไว้

-- 1) โต๊ะ 01 เต็มแล้ว: Group C จองเพิ่มไม่ได้          → {"ok": false, "code": "TABLE_FULL", "remaining": 0}
select public.create_booking((select id from public.event_tables where table_no = 1), 'Group C', 'ทดสอบ', '080-000-0000', 1);

-- 2) Group B ยังไม่ Paid: เช็กอินไม่ได้                 → NOT_PAID  (B ยังไม่มี token จึงได้ NOT_FOUND ก็ถือว่าผ่าน)
select public.confirm_checkin(coalesce((select qr_token from public.bookings where code = 'RB-0002'), 'none'), 'test-b-1');

-- 3) Group A เช็กอินได้ 5 ครั้ง                          → ok true, remaining 4,3,2,1,0
select public.confirm_checkin((select qr_token from public.bookings where code = 'RB-0001'), 'test-a-' || n) from generate_series(1, 5) n;

-- 4) ครั้งที่ 6 ถูกปฏิเสธ                                 → QUOTA_FULL
select public.confirm_checkin((select qr_token from public.bookings where code = 'RB-0001'), 'test-a-6');

-- 5) ส่ง requestId เดิมซ้ำ ไม่เพิ่มยอด                  → DUPLICATE
select public.confirm_checkin((select qr_token from public.bookings where code = 'RB-0001'), 'test-a-1');

-- 6) Dashboard ตรงกับ Log                                → Group A: checked_in 5, remaining 0
select code, group_name, seat_count, checked_in, remaining, payment_status from public.v_group_summary order by code;
select * from public.v_dashboard;

-- ล้างผลทดสอบ (ลบ Log ที่สร้างจากไฟล์นี้)
delete from public.checkin_logs where request_id like 'test-%';
