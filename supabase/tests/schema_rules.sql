-- Schema rule checks. Runs in CI against a plain Postgres with a stub auth
-- schema (see .github/workflows/ci.yml). Any failed expectation raises.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.expect_error(sql text, label text)
returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED FAILURE DID NOT HAPPEN: %', label;
exception
  when others then
    if sqlerrm like 'EXPECTED FAILURE%' then raise; end if;
    raise notice 'ok (rejected): %', label;
end;
$$;

insert into auth.users values ('11111111-1111-1111-1111-111111111111');
select pg_temp.expect_error($$
  insert into public.members (id, gym_id)
  values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001')
$$, 'member without a recorded privacy consent');
insert into public.members (id, gym_id, privacy_consent_at, privacy_notice_version)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
        now(), 'test');

-- New members start pending, target 3, hidden from the TV.
do $$
declare m record;
begin
  select * into m from public.members limit 1;
  if m.status <> 'pending' or m.weekly_target <> 3 or m.show_on_tv then
    raise exception 'unexpected member defaults: %', row_to_json(m);
  end if;
end $$;

insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        '2026-11-23 07:30+08', '2026-11-23', true, 'qr');

select pg_temp.expect_error($$
  insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
  values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          '2026-11-23 19:30+08', '2026-11-23', true, 'qr')
$$, 'second counted check-in on the same Manila day');

-- An extra scan the same day is fine when not counted.
insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        '2026-11-23 19:30+08', '2026-11-23', false, 'qr');

select pg_temp.expect_error($$
  insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
  values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          '2026-11-24 07:30+08', '2026-11-23', true, 'qr')
$$, 'day_key that is the UTC date instead of the Manila date');

select pg_temp.expect_error($$
  insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
  values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          '2026-11-25 07:30+08', '2026-11-25', true, 'manual')
$$, 'manual check-in without a reason');

-- Voiding the counted check-in frees the day.
update public.check_ins set voided_at = now(), void_reason = 'test'
where counted and day_key = '2026-11-23';
insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        '2026-11-23 20:00+08', '2026-11-23', true, 'qr');

select pg_temp.expect_error($$
  insert into public.closure_weeks (gym_id, week_start)
  values ('00000000-0000-0000-0000-000000000001', '2026-11-24')
$$, 'closure week that does not start on a Monday');
insert into public.closure_weeks (gym_id, week_start)
values ('00000000-0000-0000-0000-000000000001', '2026-11-23');

insert into public.xp_ledger (gym_id, member_id, amount, kind, ref)
values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        50, 'check_in', '2026-11-23');

select pg_temp.expect_error($$
  insert into public.xp_ledger (gym_id, member_id, amount, kind, ref)
  values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          50, 'check_in', '2026-11-23')
$$, 'granting the same check-in XP twice');

select pg_temp.expect_error($$
  insert into public.xp_ledger (gym_id, member_id, amount, kind)
  values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
          -50, 'adjustment')
$$, 'XP adjustment without a reason');

select pg_temp.expect_error($$ update public.xp_ledger set amount = 999 $$, 'editing XP');
select pg_temp.expect_error($$ delete from public.xp_ledger $$, 'deleting XP');

-- Deleting an account removes all of the member's rows.
delete from auth.users;
do $$
begin
  if (select count(*) from public.xp_ledger) + (select count(*) from public.check_ins)
     + (select count(*) from public.members) <> 0 then
    raise exception 'account delete left rows behind';
  end if;
end $$;

-- RLS is on for every table.
do $$
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ) then
    raise exception 'a public table has RLS disabled';
  end if;
end $$;

\echo 'All schema rule checks passed'
