-- =====================================================================
-- Reunion Table Booking · Supabase schema (Prototype v0.1)
-- วิธีใช้: Supabase Dashboard > SQL Editor > New query > วางทั้งไฟล์ > Run
-- รันซ้ำได้: ส่วนแรกจะลบของเดิมทิ้งก่อน (ข้อมูลเดโมจะหายทั้งหมด)
-- =====================================================================

-- ---------- 0) Reset (สำหรับเดโมเท่านั้น) ----------
drop view if exists public.v_dashboard, public.v_group_summary, public.v_table_summary cascade;
drop table if exists public.checkin_logs, public.bookings, public.booking_groups, public.event_tables, public.events cascade;
drop sequence if exists public.booking_code_seq;

-- ---------- 1) Tables (ตาม Data Model ในเอกสาร ข้อ 7) ----------
create table public.events (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  school         text,
  event_date     timestamptz not null,
  venue          text,
  price_per_seat int  not null default 0,
  status         text not null default 'open' check (status in ('draft','open','closed'))
);

create table public.event_tables (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events(id) on delete cascade,
  table_no  int  not null,
  capacity  int  not null default 10 check (capacity > 0),
  unique (event_id, table_no)
);

create table public.booking_groups (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  group_name   text not null,
  contact_name text not null,
  phone        text not null,
  created_at   timestamptz not null default now()
);

create sequence public.booking_code_seq;

create table public.bookings (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique default 'RB-' || lpad(nextval('public.booking_code_seq')::text, 4, '0'),
  group_id       uuid not null references public.booking_groups(id) on delete cascade,
  table_id       uuid not null references public.event_tables(id),
  seat_count     int  not null check (seat_count > 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  status         text not null default 'active'  check (status in ('active','cancelled')),
  -- Prototype: เก็บ token สุ่มตรง ๆ เพื่อให้หน้า Ticket แสดง QR ซ้ำได้ (Production ค่อยเปลี่ยนเป็น qr_token_hash)
  qr_token       text unique,
  created_at     timestamptz not null default now(),
  paid_at        timestamptz
);
create index on public.bookings (table_id);

create table public.checkin_logs (
  id            bigint generated always as identity primary key,
  booking_id    uuid not null references public.bookings(id) on delete cascade,
  staff_id      uuid references auth.users(id),
  checked_in_at timestamptz not null default now(),
  request_id    text not null unique          -- idempotency key กันกด Confirm ซ้ำ
);
create index on public.checkin_logs (booking_id);

-- ---------- 2) Row Level Security ----------
-- anon (แขก) อ่าน/เขียนตารางตรง ๆ ไม่ได้เลย ต้องผ่านฟังก์ชันด้านล่างเท่านั้น
-- authenticated (Staff/Admin ที่ล็อกอิน) อ่านได้ทุกตาราง เพื่อทำ Dashboard
alter table public.events         enable row level security;
alter table public.event_tables   enable row level security;
alter table public.booking_groups enable row level security;
alter table public.bookings       enable row level security;
alter table public.checkin_logs   enable row level security;

create policy staff_read on public.events         for select to authenticated using (true);
create policy staff_read on public.event_tables   for select to authenticated using (true);
create policy staff_read on public.booking_groups for select to authenticated using (true);
create policy staff_read on public.bookings       for select to authenticated using (true);
create policy staff_read on public.checkin_logs   for select to authenticated using (true);

-- ---------- 3) Views สำหรับ Dashboard และ Export Excel ----------
-- ยอดเข้างานนับจาก checkin_logs เท่านั้น
create view public.v_group_summary with (security_invoker = true) as
select b.id as booking_id, b.code, g.event_id, g.group_name, g.contact_name, g.phone,
       t.table_no, b.seat_count, b.payment_status, b.status,
       count(l.id)::int                    as checked_in,
       b.seat_count - count(l.id)::int     as remaining,
       b.created_at, b.paid_at
from public.bookings b
join public.booking_groups g on g.id = b.group_id
join public.event_tables  t on t.id = b.table_id
left join public.checkin_logs l on l.booking_id = b.id
group by b.id, g.id, t.id;

create view public.v_table_summary with (security_invoker = true) as
select t.event_id, t.table_no, t.capacity,
       coalesce(sum(b.seat_count) filter (where b.status = 'active'), 0)::int              as booked_seats,
       t.capacity - coalesce(sum(b.seat_count) filter (where b.status = 'active'), 0)::int as remaining_seats,
       count(b.id) filter (where b.status = 'active')::int                                 as group_count
from public.event_tables t
left join public.bookings b on b.table_id = t.id
group by t.id;

create view public.v_dashboard with (security_invoker = true) as
select e.id as event_id, e.name,
  (select count(*) from public.event_tables t where t.event_id = e.id)::int                                 as tables_total,
  (select count(*) from public.v_table_summary s where s.event_id = e.id and s.booked_seats > 0)::int       as tables_booked,
  (select coalesce(sum(seat_count),0) from public.v_group_summary s where s.event_id = e.id and s.status = 'active')::int as seats_booked,
  (select coalesce(sum(checked_in),0) from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'paid')::int as checked_in,
  (select coalesce(sum(remaining),0)  from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'paid')::int as not_arrived,
  (select count(*) from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'pending')::int as pending_groups,
  now() as generated_at
from public.events e;

-- ---------- 4) Functions (ตาม API ในเอกสาร ข้อ 8) ----------

-- ข้อมูลงาน (หน้า Home) · Guest
create or replace function public.get_event()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'name', name, 'school', school, 'event_date', event_date,
                            'venue', venue, 'price_per_seat', price_per_seat)
  from events where status = 'open' order by event_date limit 1;
$$;

-- GET /api/tables  · Guest
create or replace function public.get_tables(p_event_id uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'table_id', t.id, 'table_no', t.table_no, 'capacity', t.capacity,
           'booked', coalesce(x.booked,0), 'remaining', t.capacity - coalesce(x.booked,0))
         order by t.table_no), '[]'::jsonb)
  from event_tables t
  left join (select table_id, sum(seat_count)::int booked from bookings where status = 'active' group by table_id) x
         on x.table_id = t.id
  where t.event_id = coalesce(p_event_id, (select id from events where status = 'open' order by event_date limit 1));
$$;

-- POST /api/bookings  · Guest  (ล็อกแถวโต๊ะ กันจองเกินความจุเมื่อจองพร้อมกัน)
create or replace function public.create_booking(p_table_id uuid, p_group_name text, p_contact_name text, p_phone text, p_seats int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_table event_tables; v_taken int; v_group uuid; v_booking bookings;
begin
  if p_seats is null or p_seats < 1 then
    return jsonb_build_object('ok', false, 'code', 'INVALID_SEATS');
  end if;
  if coalesce(trim(p_group_name),'') = '' or coalesce(trim(p_contact_name),'') = '' or coalesce(trim(p_phone),'') = '' then
    return jsonb_build_object('ok', false, 'code', 'MISSING_FIELDS');
  end if;

  select * into v_table from event_tables where id = p_table_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND'); end if;

  select coalesce(sum(seat_count),0) into v_taken from bookings where table_id = p_table_id and status = 'active';
  if v_taken + p_seats > v_table.capacity then
    return jsonb_build_object('ok', false, 'code', 'TABLE_FULL', 'remaining', v_table.capacity - v_taken);
  end if;

  insert into booking_groups (event_id, group_name, contact_name, phone)
  values (v_table.event_id, trim(p_group_name), trim(p_contact_name), trim(p_phone))
  returning id into v_group;

  insert into bookings (group_id, table_id, seat_count) values (v_group, p_table_id, p_seats)
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'code', v_booking.code, 'payment_status', v_booking.payment_status);
end $$;

-- หน้า Group Ticket · Guest (ส่ง qr_token ให้เฉพาะเมื่อ Paid แล้ว)
create or replace function public.get_ticket(p_booking_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', s.code, 'group_name', s.group_name, 'table_no', s.table_no, 'seat_count', s.seat_count,
    'payment_status', s.payment_status, 'status', s.status, 'checked_in', s.checked_in, 'remaining', s.remaining,
    'qr_token', case when s.payment_status = 'paid' and s.status = 'active' then b.qr_token end)
  from v_group_summary s join bookings b on b.id = s.booking_id
  where s.booking_id = p_booking_id;
$$;

-- POST /api/demo/approve-payment · Admin
create or replace function public.approve_payment(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v bookings;
begin
  update bookings
     set payment_status = 'paid',
         paid_at  = coalesce(paid_at, now()),
         qr_token = coalesce(qr_token, 'RTB-' || upper(encode(extensions.gen_random_bytes(9), 'hex')))
   where id = p_booking_id and status = 'active'
  returning * into v;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND_OR_CANCELLED'); end if;
  return jsonb_build_object('ok', true, 'code', v.code, 'payment_status', v.payment_status, 'qr_token', v.qr_token);
end $$;

-- Admin: ยกเลิก Booking (คืนที่นั่งให้โต๊ะ)
create or replace function public.cancel_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  update bookings set status = 'cancelled' where id = p_booking_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- POST /api/checkin/resolve · Staff (อ่าน QR อย่างเดียว ไม่เพิ่มยอด)
create or replace function public.resolve_checkin(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'booking_id', s.booking_id, 'code', s.code, 'group_name', s.group_name,
              'table_no', s.table_no, 'total', s.seat_count, 'used', s.checked_in, 'remaining', s.remaining,
              'payment_status', s.payment_status, 'status', s.status)
       from v_group_summary s join bookings b on b.id = s.booking_id
      where b.qr_token = trim(p_token)),
    jsonb_build_object('ok', false, 'code', 'NOT_FOUND'));
$$;

-- POST /api/checkin/confirm · Staff
-- ตรวจซ้ำ + ตรวจสิทธิ์ + บันทึก ภายใน Transaction เดียว โดยล็อกแถว booking ไว้
create or replace function public.confirm_checkin(p_token text, p_request_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b bookings; v_used int;
begin
  select * into b from bookings where qr_token = trim(p_token) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND'); end if;

  select count(*) into v_used from checkin_logs where booking_id = b.id;

  if exists (select 1 from checkin_logs where request_id = p_request_id) then
    return jsonb_build_object('ok', false, 'code', 'DUPLICATE', 'used', v_used, 'remaining', b.seat_count - v_used);
  end if;
  if b.status <> 'active' then
    return jsonb_build_object('ok', false, 'code', 'CANCELLED', 'used', v_used, 'remaining', b.seat_count - v_used);
  end if;
  if b.payment_status <> 'paid' then
    return jsonb_build_object('ok', false, 'code', 'NOT_PAID', 'used', v_used, 'remaining', b.seat_count - v_used);
  end if;
  if v_used >= b.seat_count then
    return jsonb_build_object('ok', false, 'code', 'QUOTA_FULL', 'used', v_used, 'remaining', 0);
  end if;

  insert into checkin_logs (booking_id, staff_id, request_id) values (b.id, auth.uid(), p_request_id);
  return jsonb_build_object('ok', true, 'used', v_used + 1, 'remaining', b.seat_count - v_used - 1);
end $$;

-- ---------- 5) สิทธิ์เรียกใช้ฟังก์ชัน ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant  execute on function public.get_event()                               to anon, authenticated;
grant  execute on function public.get_tables(uuid)                         to anon, authenticated;
grant  execute on function public.create_booking(uuid, text, text, text, int) to anon, authenticated;
grant  execute on function public.get_ticket(uuid)                          to anon, authenticated;
grant  execute on function public.approve_payment(uuid)                     to authenticated;
grant  execute on function public.cancel_booking(uuid)                      to authenticated;
grant  execute on function public.resolve_checkin(text)                     to authenticated;
grant  execute on function public.confirm_checkin(text, text)               to authenticated;
revoke all on public.v_dashboard, public.v_group_summary, public.v_table_summary from anon;

-- ---------- 6) Realtime (ให้หน้าจอ Staff/Dashboard รู้ทันทีเมื่อมีเช็กอินใหม่) ----------
alter publication supabase_realtime add table public.checkin_logs;

-- ---------- 7) Seed: งาน 1 งาน · 20 โต๊ะ · โต๊ะละ 10 ที่ ----------
with e as (
  insert into public.events (name, school, event_date, venue, price_per_seat)
  values ('งานคืนสู่เหย้า ศิษย์เก่ารุ่น 2529', 'โรงเรียนตัวอย่างวิทยาคม', '2026-12-19 18:00+07', 'หอประชุมโรงเรียน', 1500)
  returning id
)
insert into public.event_tables (event_id, table_no, capacity)
select e.id, n, 10 from e, generate_series(1, 20) n;

-- Demo Scenario: Group A + Group B จองโต๊ะ 01 คนละ 5 ที่ และ A ชำระแล้ว
select public.create_booking((select id from public.event_tables where table_no = 1), 'Group A · ห้อง ม.6/1', 'สมชาย ใจดี', '081-234-5678', 5);
select public.create_booking((select id from public.event_tables where table_no = 1), 'Group B · ห้อง ม.6/3', 'วิภาวรรณ สุขสันต์', '089-111-2233', 5);
select public.approve_payment((select id from public.bookings where code = 'RB-0001'));

-- ---------- ตรวจผล ----------
select * from public.v_dashboard;
