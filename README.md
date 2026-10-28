# Reunion Table Booking (Prototype)

เว็บแอปจองโต๊ะงานเลี้ยงรุ่นแบบ Mobile-First ตามเอกสาร *Reunion Booking Prototype Spec v0.1*
Next.js 15 + TypeScript + Supabase · เดโมเท่านั้น ไม่มีการรับชำระเงินจริง

## หน้าจอ

| Screen | Route | ผู้ใช้ |
|---|---|---|
| S01 Home | `/` | Guest |
| S02 Table List | `/tables` | Guest |
| S03 Group Form | `/book/[tableId]` | Guest |
| S04 Payment Demo | `/booking/[id]` | Guest (Admin เห็นปุ่มยืนยันชำระเมื่อล็อกอิน) |
| S05 Group Ticket | `/ticket/[id]` | Guest |
| S06 Staff Scanner | `/staff/checkin` | Staff |
| S07 Dashboard | `/admin/dashboard` | Admin (Realtime + อัปเดตทุก 5 นาที + Export Excel) |
| รายการจอง | `/admin/bookings` | Admin |

API ตามเอกสารข้อ 8 ทำเป็น Postgres Function ใน `supabase/schema.sql` เรียกผ่าน `supabase.rpc()`:
`get_tables`, `create_booking`, `approve_payment`, `resolve_checkin`, `confirm_checkin` และ View สำหรับ Dashboard
การเช็กอินตรวจ requestId ซ้ำและสิทธิ์คงเหลือใน Transaction เดียว (ล็อกแถว booking)

## ติดตั้งครั้งแรก

1. **Supabase** > SQL Editor > วาง `supabase/schema.sql` ทั้งไฟล์ > Run
   แล้วรัน `supabase/test-acceptance.sql` ทีละบรรทัดเพื่อตรวจกติกา
2. **Supabase** > Authentication
   - ปิด *Allow new users to sign up*
   - Users > Add user > สร้างบัญชี Staff/Admin (ติ๊ก Auto confirm)
3. คัดลอก anon / publishable key จาก Project Settings > API ใส่ใน `.env.local`
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://cagswdlqrjiqifcfqxpw.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   ห้ามใช้ service_role / secret key ในแอปนี้
4. รันบนเครื่อง
   ```
   npm install
   npm run dev
   ```
   เปิด http://localhost:3000

## ทดสอบกล้องบนมือถือ

กล้องเปิดได้เฉพาะ HTTPS หรือ localhost
- ทางที่ง่ายที่สุด: Deploy ขึ้น Vercel (ด้านล่าง) แล้วเปิด URL บนมือถือ
- หรือ `npm run dev:https` แล้วเปิดจากมือถือในวง Wi-Fi เดียวกัน (ต้องกดยอมรับใบรับรองที่สร้างเอง)

## Deploy ขึ้น Vercel

1. Push โฟลเดอร์นี้ขึ้น GitHub
2. Vercel > Add New Project > เลือก Repo
3. Environment Variables: ใส่ `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Excel ที่ Export ได้

ปุ่ม **Export Excel** ใน Dashboard และหน้ารายการจอง สร้างไฟล์ `.xlsx` ในเบราว์เซอร์ มี 5 ชีต:
สรุป · ราย Group · รายโต๊ะ · รายการจอง (มีชื่อและเบอร์โทร) · Check-in Log
ไฟล์มีข้อมูลส่วนบุคคล ควรเก็บและส่งต่อเฉพาะผู้เกี่ยวข้อง

## รีเซ็ตเดโม

รัน `supabase/schema.sql` ซ้ำ จะลบข้อมูลทั้งหมดและสร้างข้อมูลตัวอย่างใหม่ (Group A/B ที่โต๊ะ 01)

## ข้อจำกัด (Prototype)

- Staff และ Admin ใช้สิทธิ์เดียวกัน (ผู้ที่ล็อกอินทุกคน) ยังไม่แยก Role
- ลิงก์หน้าตั๋ว `/ticket/[id]` เป็นกุญแจในการดู QR ใครมีลิงก์ก็เปิดตั๋วได้
- `qr_token` เก็บแบบไม่ hash เพื่อให้หน้าตั๋วแสดง QR ซ้ำได้ (Production ควรเปลี่ยน)
- ไม่มีการชำระเงินจริง ไม่มี OTP ไม่รองรับ Offline
- Supabase แพ็กเกจฟรีจะพักโปรเจกต์ถ้าไม่มีการใช้งานราว 1 สัปดาห์ ควรเปิดใช้งานก่อนวันเดโม
