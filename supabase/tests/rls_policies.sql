-- Row Level Security and write-function checks. Runs in CI after
-- schema_rules.sql, in the same psql session, against plain Postgres with the
-- stub in auth_stub.sql. Any failed expectation raises.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_error(sql text, label text)
returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'EXPECTED FAILURE DID NOT HAPPEN: %', label;
exception
  when others then
    if sqlerrm like 'EXPECTED FAILURE%' then raise; end if;
    raise notice 'ok (rejected): % [%]', label, sqlerrm;
end;
$$;

create or replace function pg_temp.expect(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'EXPECTATION FAILED: %', label;
  end if;
  raise notice 'ok: %', label;
end;
$$;

grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;
grant execute on function pg_temp.expect(boolean, text) to anon, authenticated;

-- Act as a signed-in user (or nobody, for the anon key).
create or replace function pg_temp.act_as(uid uuid) returns void
language plpgsql as $$
begin
  reset role;
  if uid is null then
    perform set_config('request.jwt.claims', '', false);
    set role anon;
  else
    perform set_config('request.jwt.claims', json_build_object('sub', uid)::text, false);
    set role authenticated;
  end if;
end;
$$;
grant execute on function pg_temp.act_as(uuid) to anon, authenticated;

-- Cast: A = new member, B = another member, S = staff, D = admin,
-- O = staff at another gym, N = signed in but never joined.
insert into auth.users values
  ('aaaaaaaa-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-0000-0000-000000000000'),
  ('55555555-0000-0000-0000-000000000000'),
  ('dddddddd-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000ff'),
  ('eeeeeeee-0000-0000-0000-000000000000');
insert into public.gyms (id, name, created_at)
values ('00000000-0000-0000-0000-000000000002', 'Other Gym', now() + interval '1 day');
insert into public.members
  (id, gym_id, full_name, role, status, privacy_consent_at, privacy_notice_version)
values
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001',
   'Bea', 'member', 'active', now(), 't'),
  ('55555555-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001',
   'Sam Staff', 'staff', 'active', now(), 't'),
  ('dddddddd-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001',
   'Dee Admin', 'admin', 'active', now(), 't'),
  ('00000000-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000002',
   'Other Staff', 'staff', 'active', now(), 't');
insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
values ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000',
        '2026-11-23 07:30+08', '2026-11-23', true, 'qr');
insert into public.xp_ledger (gym_id, member_id, amount, kind, ref)
values ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000',
        50, 'check_in', '2026-11-23');

-- Signed out (anon key): nothing at all ---------------------------------------
select pg_temp.act_as(null);
select pg_temp.expect_error($$ select count(*) from public.members $$, 'anon reads members');
select pg_temp.expect_error($$ select count(*) from public.gyms $$, 'anon reads gyms');
select pg_temp.expect_error($$ select public.join_gym('X', null, false, 'v1') $$, 'anon joins');
select pg_temp.expect_error($$ select public.delete_my_account() $$, 'anon deletes an account');

-- Joining ----------------------------------------------------------------------
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000000');
select pg_temp.expect_error($$ select public.join_gym('Ana', null, false, null) $$,
  'join without privacy consent');
select pg_temp.expect_error($$ select public.join_gym('   ', null, false, 'v1') $$,
  'join without a name');
select pg_temp.expect_error($$
  insert into public.members (id, gym_id, full_name, role, status, privacy_consent_at, privacy_notice_version)
  values ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001',
          'Ana', 'admin', 'active', now(), 'v1')
$$, 'member inserts their own row as an active admin');
select public.join_gym('  Ana Cruz ', ' Ana ', true, 'v1');
select public.join_gym('Changed', null, false, 'v1'); -- double tap: no change
select pg_temp.expect(
  (select full_name = 'Ana Cruz' and nickname = 'Ana' and show_on_tv
          and role = 'member' and status = 'pending'
          and privacy_notice_version = 'v1' and privacy_consent_at is not null
          and gym_id = '00000000-0000-0000-0000-000000000001'
   from public.members where id = auth.uid()),
  'join creates a pending member in the pilot gym with consent recorded');

-- A member sees only their own rows ----------------------------------------------
select pg_temp.expect((select count(*) from public.members) = 1, 'member sees only their own row');
select pg_temp.expect((select count(*) from public.check_ins) = 0, 'member sees no one else''s check-ins');
select pg_temp.expect((select count(*) from public.xp_ledger) = 0, 'member sees no one else''s XP');
select pg_temp.expect((select count(*) from public.gyms) = 1, 'member sees their own gym only');

select pg_temp.expect_error($$ update public.members set role = 'admin', status = 'active' where id = auth.uid() $$,
  'member promotes themselves');
select pg_temp.expect_error($$ delete from public.members $$, 'member deletes member rows');
select pg_temp.expect_error($$
  insert into public.check_ins (gym_id, member_id, checked_in_at, day_key, counted, method)
  values ('00000000-0000-0000-0000-000000000001', auth.uid(), now(), (now() at time zone 'Asia/Manila')::date, true, 'qr')
$$, 'member writes their own check-in directly');
select pg_temp.expect_error($$
  insert into public.xp_ledger (gym_id, member_id, amount, kind, reason)
  values ('00000000-0000-0000-0000-000000000001', auth.uid(), 99999, 'adjustment', 'free xp')
$$, 'member grants themselves XP');
select pg_temp.expect_error($$ truncate public.check_ins $$, 'member truncates check-ins');
select pg_temp.expect_error($$ select public.set_member_status(auth.uid(), 'active') $$,
  'member approves themselves');
select pg_temp.expect_error($$ select public.set_member_role(auth.uid(), 'staff') $$,
  'member makes themselves staff');

-- Profile edits
select public.update_my_profile('Ana M. Cruz', 'AnaC', false);
select pg_temp.expect(
  (select full_name = 'Ana M. Cruz' and nickname = 'AnaC' and not show_on_tv
   from public.members where id = auth.uid()),
  'pending member edits name, nickname and TV opt-in');
select pg_temp.expect_error($$ select public.update_my_profile('Ana', repeat('x', 25), false) $$,
  'nickname longer than 24');
select pg_temp.expect_error($$ select public.update_my_profile('Ana', E'bad\nnick', false) $$,
  'nickname with control characters');

-- Never joined
select pg_temp.act_as('eeeeeeee-0000-0000-0000-000000000000');
select pg_temp.expect((select count(*) from public.members) = 0, 'non-member sees no members');
select pg_temp.expect((select count(*) from public.gyms) = 0, 'non-member sees no gym');
select pg_temp.expect_error($$ select public.update_my_profile('X', null, false) $$,
  'non-member edits a profile');

-- Staff ------------------------------------------------------------------------
select pg_temp.act_as('55555555-0000-0000-0000-000000000000');
select pg_temp.expect((select count(*) from public.members) = 4, 'staff see every member of their gym, not other gyms');
select pg_temp.expect((select count(*) from public.check_ins) = 1, 'staff see their gym''s check-ins');
select public.set_member_status('aaaaaaaa-0000-0000-0000-000000000000', 'active');
select pg_temp.expect(
  (select status = 'active' and approved_by = '55555555-0000-0000-0000-000000000000'
          and approved_at is not null
   from public.members where id = 'aaaaaaaa-0000-0000-0000-000000000000'),
  'staff approve a pending member in one call');
select pg_temp.expect_error($$ select public.set_member_status('aaaaaaaa-0000-0000-0000-000000000000', 'pending') $$,
  'staff set an unknown status');
select pg_temp.expect_error($$ select public.set_member_status('55555555-0000-0000-0000-000000000000', 'deactivated') $$,
  'staff change their own status');
select pg_temp.expect_error($$ select public.set_member_status('dddddddd-0000-0000-0000-000000000000', 'deactivated') $$,
  'staff deactivate the admin');
select pg_temp.expect_error($$ select public.set_member_status('00000000-0000-0000-0000-0000000000ff', 'deactivated') $$,
  'staff change a member of another gym');
select pg_temp.expect_error($$ select public.set_member_role('bbbbbbbb-0000-0000-0000-000000000000', 'staff') $$,
  'staff promote a member');
select pg_temp.expect_error($$ update public.members set status = 'deactivated' where id = 'bbbbbbbb-0000-0000-0000-000000000000' $$,
  'staff update members directly');
select public.set_member_status('bbbbbbbb-0000-0000-0000-000000000000', 'deactivated');
select public.set_member_status('bbbbbbbb-0000-0000-0000-000000000000', 'active');

-- Admin ------------------------------------------------------------------------
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000000');
select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000000', 'staff');
select pg_temp.expect_error($$ select public.set_member_role('aaaaaaaa-0000-0000-0000-000000000000', 'admin') $$,
  'admin makes someone admin from the app');
select pg_temp.expect_error($$ select public.set_member_role('dddddddd-0000-0000-0000-000000000000', 'member') $$,
  'admin demotes themselves');

-- A (now staff) cannot change other staff; deactivated staff lose access
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000000');
select pg_temp.expect_error($$ select public.set_member_status('55555555-0000-0000-0000-000000000000', 'deactivated') $$,
  'staff deactivate other staff');
select pg_temp.act_as('dddddddd-0000-0000-0000-000000000000');
select public.set_member_status('aaaaaaaa-0000-0000-0000-000000000000', 'deactivated');
select pg_temp.act_as('aaaaaaaa-0000-0000-0000-000000000000');
select pg_temp.expect((select count(*) from public.members) = 1, 'deactivated staff see only their own row');
select pg_temp.expect_error($$ select public.set_member_status('bbbbbbbb-0000-0000-0000-000000000000', 'deactivated') $$,
  'deactivated staff use staff tools');

-- Account deletion -----------------------------------------------------------------
-- Staff S approved A and recorded an adjustment; deleting S keeps those rows.
reset role;
insert into public.xp_ledger (gym_id, member_id, amount, kind, reason, created_by)
values ('00000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000',
        10, 'adjustment', 'test', '55555555-0000-0000-0000-000000000000');
select pg_temp.act_as('55555555-0000-0000-0000-000000000000');
select public.delete_my_account();
reset role;
select pg_temp.expect(
  (select approved_by is null from public.members where id = 'aaaaaaaa-0000-0000-0000-000000000000')
  and (select created_by is null from public.xp_ledger where kind = 'adjustment' and reason = 'test')
  and not exists (select 1 from public.members where id = '55555555-0000-0000-0000-000000000000'),
  'deleting a staff account clears "by" columns and keeps others'' rows');
select pg_temp.expect_error($$ update public.xp_ledger set created_by = null $$,
  'clearing created_by outside a cascade');

select pg_temp.act_as('bbbbbbbb-0000-0000-0000-000000000000');
select public.delete_my_account();
reset role;
select pg_temp.expect(
  not exists (select 1 from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000000')
  and not exists (select 1 from public.members where id = 'bbbbbbbb-0000-0000-0000-000000000000')
  and not exists (select 1 from public.check_ins where member_id = 'bbbbbbbb-0000-0000-0000-000000000000')
  and not exists (select 1 from public.xp_ledger where member_id = 'bbbbbbbb-0000-0000-0000-000000000000'),
  'a member deletes their own account and all their rows');

-- Every table still has RLS, and every policy is read-only ---------------------------
select pg_temp.expect(
  not exists (select 1 from pg_policies where schemaname = 'public' and cmd <> 'SELECT'),
  'all policies are SELECT-only (writes go through checked functions)');
select pg_temp.expect(
  not exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')
      and (grantee = 'anon' or privilege_type <> 'SELECT')),
  'anon has no table privileges; authenticated can only SELECT');
select pg_temp.expect(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (p.proconfig is null or not ('search_path=""' = any (p.proconfig)))),
  'every SECURITY DEFINER function pins an empty search_path');
select pg_temp.expect(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
      -- extension functions (pgcrypto) are not ours
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  'anon can run none of our functions');

\echo 'All RLS checks passed'
