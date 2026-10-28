-- =====================================================================
-- Migration 002 · เทพศิรินทร์: เลือกรุ่น, ช่วงรุ่นที่ไม่ต้องชำระ, แนบสลิป, Admin จัดโต๊ะ
-- รันหลัง schema.sql · ข้อมูลการจองเดิมยังอยู่ · รันซ้ำได้
-- วิธีใช้: Supabase > SQL Editor > New query > วางทั้งไฟล์ > Run
-- =====================================================================

-- ---------- 1) คอลัมน์ใหม่ ----------
alter table public.events
  add column if not exists class_min         int not null default 70,
  add column if not exists class_max         int not null default 134,
  add column if not exists free_class_from   int,
  add column if not exists free_class_to     int,
  add column if not exists bank_name         text,
  add column if not exists bank_account_no   text,
  add column if not exists bank_account_name text;

update public.events set school = 'โรงเรียนเทพศิรินทร์';

alter table public.booking_groups add column if not exists class_no int;

-- แขกไม่เลือกโต๊ะแล้ว Admin เป็นคนจัดโต๊ะภายหลัง
alter table public.bookings alter column table_id drop not null;
alter table public.bookings
  add column if not exists is_free          boolean not null default false,
  add column if not exists amount           int     not null default 0,
  add column if not exists slip_path        text,
  add column if not exists slip_uploaded_at timestamptz;

update public.bookings b set amount = b.seat_count * e.price_per_seat
from public.booking_groups g join public.events e on e.id = g.event_id
where g.id = b.group_id and b.amount = 0 and not b.is_free;

-- ---------- 2) Views (สร้างใหม่ให้รองรับโต๊ะว่างและคอลัมน์ใหม่) ----------
drop view if exists public.v_dashboard, public.v_group_summary, public.v_table_summary cascade;

create view public.v_group_summary with (security_invoker = true) as
select b.id as booking_id, b.code, g.event_id, g.class_no, g.group_name, g.contact_name, g.phone,
       b.table_id, t.table_no, b.seat_count, b.amount, b.is_free, b.payment_status, b.status,
       b.slip_path, b.slip_uploaded_at,
       count(l.id)::int                as checked_in,
       b.seat_count - count(l.id)::int as remaining,
       b.created_at, b.paid_at
from public.bookings b
join public.booking_groups g on g.id = b.group_id
left join public.event_tables t on t.id = b.table_id
left join public.checkin_logs l on l.booking_id = b.id
group by b.id, g.id, t.id;

create view public.v_table_summary with (security_invoker = true) as
select t.id as table_id, t.event_id, t.table_no, t.capacity,
       coalesce(sum(b.seat_count) filter (where b.status = 'active'), 0)::int              as booked_seats,
       t.capacity - coalesce(sum(b.seat_count) filter (where b.status = 'active'), 0)::int as remaining_seats,
       count(b.id) filter (where b.status = 'active')::int                                 as group_count
from public.event_tables t
left join public.bookings b on b.table_id = t.id
group by t.id;

create view public.v_dashboard with (security_invoker = true) as
select e.id as event_id, e.name,
  (select count(*) from public.event_tables t where t.event_id = e.id)::int                                as tables_total,
  (select count(*) from public.v_table_summary s where s.event_id = e.id and s.booked_seats > 0)::int      as tables_booked,
  (select coalesce(sum(capacity),0) from public.event_tables t where t.event_id = e.id)::int               as seats_total,
  (select coalesce(sum(seat_count),0) from public.v_group_summary s where s.event_id = e.id and s.status = 'active')::int as seats_booked,
  (select coalesce(sum(checked_in),0) from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'paid')::int as checked_in,
  (select coalesce(sum(remaining),0)  from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'paid')::int as not_arrived,
  (select count(*) from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'pending')::int as pending_groups,
  (select count(*) from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'pending' and s.slip_path is not null)::int as slips_waiting,
  (select count(*) from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.table_id is null)::int as unassigned_groups,
  (select coalesce(sum(amount),0) from public.v_group_summary s where s.event_id = e.id and s.status = 'active' and s.payment_status = 'paid')::int as paid_amount,
  now() as generated_at
from public.events e;

-- ---------- 3) Functions ----------
create or replace function public.current_event_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from events where status = 'open' order by event_date limit 1;
$$;

create or replace function public.get_event()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'name', e.name, 'school', e.school, 'event_date', e.event_date, 'venue', e.venue,
    'price_per_seat', e.price_per_seat, 'class_min', e.class_min, 'class_max', e.class_max,
    'free_class_from', e.free_class_from, 'free_class_to', e.free_class_to,
    'bank_name', e.bank_name, 'bank_account_no', e.bank_account_no, 'bank_account_name', e.bank_account_name,
    'seats_total', (select coalesce(sum(capacity),0) from event_tables where event_id = e.id),
    'seats_booked', (select coalesce(sum(b.seat_count),0) from bookings b join booking_groups g on g.id = b.group_id
                      where g.event_id = e.id and b.status = 'active'))
  from events e where e.id = current_event_id();
$$;

-- จองโดยเลือกรุ่น (ไม่เลือกโต๊ะ) · รุ่นในช่วงฟรีได้สถานะ Paid ทันที
drop function if exists public.create_booking(uuid, text, text, text, int);
create or replace function public.create_booking(p_class_no int, p_group_name text, p_contact_name text, p_phone text, p_seats int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare e events; v_total int; v_taken int; v_free boolean; v_group uuid; v_booking bookings;
begin
  if p_seats is null or p_seats < 1 then return jsonb_build_object('ok', false, 'code', 'INVALID_SEATS'); end if;
  if coalesce(trim(p_group_name),'') = '' or coalesce(trim(p_contact_name),'') = '' or coalesce(trim(p_phone),'') = '' then
    return jsonb_build_object('ok', false, 'code', 'MISSING_FIELDS');
  end if;

  -- ล็อกแถวงาน ให้การจองพร้อมกันเข้าคิวทีละรายการ กันที่นั่งรวมเกิน
  select * into e from events where id = current_event_id() for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NO_EVENT'); end if;
  if p_class_no is null or p_class_no < e.class_min or p_class_no > e.class_max then
    return jsonb_build_object('ok', false, 'code', 'INVALID_CLASS');
  end if;

  select coalesce(sum(capacity),0) into v_total from event_tables where event_id = e.id;
  select coalesce(sum(b.seat_count),0) into v_taken from bookings b join booking_groups g on g.id = b.group_id
   where g.event_id = e.id and b.status = 'active';
  if v_taken + p_seats > v_total then
    return jsonb_build_object('ok', false, 'code', 'EVENT_FULL', 'remaining', v_total - v_taken);
  end if;

  v_free := e.free_class_from is not null and e.free_class_to is not null
            and p_class_no between e.free_class_from and e.free_class_to;

  insert into booking_groups (event_id, class_no, group_name, contact_name, phone)
  values (e.id, p_class_no, trim(p_group_name), trim(p_contact_name), trim(p_phone))
  returning id into v_group;

  insert into bookings (group_id, seat_count, is_free, amount, payment_status, paid_at, qr_token)
  values (v_group, p_seats, v_free, case when v_free then 0 else p_seats * e.price_per_seat end,
          case when v_free then 'paid' else 'pending' end,
          case when v_free then now() end,
          case when v_free then 'RTB-' || upper(encode(extensions.gen_random_bytes(9), 'hex')) end)
  returning * into v_booking;

  return jsonb_build_object('ok', true, 'booking_id', v_booking.id, 'code', v_booking.code,
                            'payment_status', v_booking.payment_status, 'is_free', v_booking.is_free);
end $$;

create or replace function public.get_ticket(p_booking_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', s.code, 'class_no', s.class_no, 'group_name', s.group_name, 'table_no', s.table_no,
    'seat_count', s.seat_count, 'amount', s.amount, 'is_free', s.is_free,
    'payment_status', s.payment_status, 'status', s.status, 'checked_in', s.checked_in, 'remaining', s.remaining,
    'has_slip', s.slip_path is not null, 'slip_uploaded_at', s.slip_uploaded_at,
    'qr_token', case when s.payment_status = 'paid' and s.status = 'active' then b.qr_token end)
  from v_group_summary s join bookings b on b.id = s.booking_id
  where s.booking_id = p_booking_id;
$$;

-- ใช้ใน Storage policy: แนบสลิปได้เฉพาะโฟลเดอร์ของ Booking ที่ยังรอชำระ
create or replace function public.can_upload_slip(p_object_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bookings
    where id::text = split_part(p_object_name, '/', 1)
      and status = 'active' and payment_status = 'pending' and not is_free);
$$;

create or replace function public.attach_slip(p_booking_id uuid, p_path text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if split_part(p_path, '/', 1) <> p_booking_id::text then
    return jsonb_build_object('ok', false, 'code', 'INVALID_PATH');
  end if;
  update bookings set slip_path = p_path, slip_uploaded_at = now()
   where id = p_booking_id and status = 'active' and payment_status = 'pending' and not is_free;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_PENDING'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Admin จัดโต๊ะ (p_table_id = null คือเอาออกจากโต๊ะ)
create or replace function public.assign_table(p_booking_id uuid, p_table_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_table event_tables; v_seats int; v_taken int;
begin
  select seat_count into v_seats from bookings where id = p_booking_id and status = 'active' for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'NOT_FOUND_OR_CANCELLED'); end if;
  if p_table_id is not null then
    select * into v_table from event_tables where id = p_table_id for update;
    if not found then return jsonb_build_object('ok', false, 'code', 'TABLE_NOT_FOUND'); end if;
    select coalesce(sum(seat_count),0) into v_taken from bookings
     where table_id = p_table_id and status = 'active' and id <> p_booking_id;
    if v_taken + v_seats > v_table.capacity then
      return jsonb_build_object('ok', false, 'code', 'TABLE_FULL', 'remaining', v_table.capacity - v_taken);
    end if;
  end if;
  update bookings set table_id = p_table_id where id = p_booking_id;
  return jsonb_build_object('ok', true);
end $$;

-- Admin ตั้งค่างาน · ช่วงรุ่นฟรีใหม่มีผลกับ Booking ที่ยังรอชำระด้วย
create or replace function public.update_event_settings(
  p_free_from int, p_free_to int, p_price int, p_bank_name text, p_bank_account_no text, p_bank_account_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_event uuid := current_event_id(); v_converted int;
begin
  if (p_free_from is null) <> (p_free_to is null) or p_free_from > p_free_to then
    return jsonb_build_object('ok', false, 'code', 'INVALID_RANGE');
  end if;
  update events set free_class_from = p_free_from, free_class_to = p_free_to,
                    price_per_seat = coalesce(p_price, price_per_seat),
                    bank_name = nullif(trim(p_bank_name),''), bank_account_no = nullif(trim(p_bank_account_no),''),
                    bank_account_name = nullif(trim(p_bank_account_name),'')
   where id = v_event;

  -- ยอดของ Booking ที่ยังรอชำระคิดตามราคาใหม่
  update bookings b set amount = b.seat_count * e.price_per_seat
    from booking_groups g, events e
   where g.id = b.group_id and e.id = g.event_id and g.event_id = v_event
     and b.status = 'active' and b.payment_status = 'pending' and not b.is_free;

  with c as (
    update bookings b set is_free = true, amount = 0, payment_status = 'paid', paid_at = now(),
           qr_token = coalesce(b.qr_token, 'RTB-' || upper(encode(extensions.gen_random_bytes(9), 'hex')))
      from booking_groups g
     where g.id = b.group_id and g.event_id = v_event and p_free_from is not null
       and b.status = 'active' and b.payment_status = 'pending'
       and g.class_no between p_free_from and p_free_to
    returning b.id)
  select count(*) into v_converted from c;
  return jsonb_build_object('ok', true, 'converted', v_converted);
end $$;

create or replace function public.resolve_checkin(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('ok', true, 'booking_id', s.booking_id, 'code', s.code, 'class_no', s.class_no,
              'group_name', s.group_name, 'table_no', s.table_no, 'total', s.seat_count, 'used', s.checked_in,
              'remaining', s.remaining, 'payment_status', s.payment_status, 'status', s.status, 'is_free', s.is_free)
       from v_group_summary s join bookings b on b.id = s.booking_id
      where b.qr_token = trim(p_token)),
    jsonb_build_object('ok', false, 'code', 'NOT_FOUND'));
$$;

-- ---------- 4) สิทธิ์ ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.current_event_id()                         to anon, authenticated;
grant execute on function public.get_event()                                to anon, authenticated;
grant execute on function public.get_tables(uuid)                           to anon, authenticated;
grant execute on function public.create_booking(int, text, text, text, int) to anon, authenticated;
grant execute on function public.get_ticket(uuid)                           to anon, authenticated;
grant execute on function public.can_upload_slip(text)                      to anon, authenticated;
grant execute on function public.attach_slip(uuid, text)                    to anon, authenticated;
grant execute on function public.approve_payment(uuid)                      to authenticated;
grant execute on function public.cancel_booking(uuid)                       to authenticated;
grant execute on function public.assign_table(uuid, uuid)                   to authenticated;
grant execute on function public.update_event_settings(int, int, int, text, text, text) to authenticated;
grant execute on function public.resolve_checkin(text)                      to authenticated;
grant execute on function public.confirm_checkin(text, text)                to authenticated;
revoke all on public.v_dashboard, public.v_group_summary, public.v_table_summary from anon;

-- ---------- 5) Storage: bucket สลิป (ส่วนตัว ไม่เปิดสาธารณะ) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('slips', 'slips', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists slips_upload on storage.objects;
drop policy if exists slips_read   on storage.objects;
create policy slips_upload on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'slips' and public.can_upload_slip(name));
create policy slips_read on storage.objects for select to authenticated
  using (bucket_id = 'slips');

notify pgrst, 'reload schema';

-- ตรวจผล
select public.get_event();
