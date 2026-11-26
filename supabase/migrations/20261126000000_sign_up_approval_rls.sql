-- Week 2: sign-up with consent, staff approval, and Row Level Security.
--
-- Security model (see CLAUDE.md, "Database"):
--   * Signed-in users READ through RLS policies: their own rows, plus every
--     row of their gym when they are active staff or admin.
--   * Nobody writes tables directly from the browser. Every write goes
--     through one of the SECURITY DEFINER functions below, which check who is
--     calling and only touch the columns they are meant to. This is what stops
--     a member from setting their own role or status.
--   * The anon key (signed out) can read and write nothing.

-- Consent record ---------------------------------------------------------------
-- Which privacy notice the member agreed to (privacy_consent_at holds when).
alter table public.members add column privacy_notice_version text;

alter table public.members
  add constraint members_full_name_length check (char_length(full_name) <= 80),
  add constraint members_nickname_printable check (nickname !~ '[[:cntrl:]]'),
  add constraint members_full_name_printable check (full_name !~ '[[:cntrl:]]'),
  -- Nobody becomes a member without agreeing to the privacy notice.
  add constraint members_consent_recorded
    check (privacy_consent_at is not null and privacy_notice_version is not null)
    not valid;

-- Account deletion (RA 10173) ----------------------------------------------------
-- Deleting a staff account must not fail because they approved someone or
-- recorded a check-in. Those "by" columns become null instead.
alter table public.members
  drop constraint members_approved_by_fkey,
  add constraint members_approved_by_fkey
    foreign key (approved_by) references public.members (id) on delete set null;
alter table public.check_ins
  drop constraint check_ins_created_by_fkey,
  add constraint check_ins_created_by_fkey
    foreign key (created_by) references public.members (id) on delete set null,
  drop constraint check_ins_voided_by_fkey,
  add constraint check_ins_voided_by_fkey
    foreign key (voided_by) references public.members (id) on delete set null;
alter table public.xp_ledger
  drop constraint xp_ledger_created_by_fkey,
  add constraint xp_ledger_created_by_fkey
    foreign key (created_by) references public.members (id) on delete set null;

-- The ledger stays append-only. Two exceptions, both only from a foreign key
-- cascade (trigger depth > 1): deleting a member's own rows, and clearing
-- created_by when the staff account that made an adjustment is deleted.
create or replace function public.xp_ledger_is_append_only() returns trigger
language plpgsql as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    if tg_op = 'UPDATE' and new.created_by is null
       and (to_jsonb(new) - 'created_by') = (to_jsonb(old) - 'created_by') then
      return new;
    end if;
  end if;
  raise exception 'xp_ledger is append-only; add an adjustment row instead';
end;
$$;

-- Table privileges ----------------------------------------------------------------
-- Supabase grants everything on new tables to anon and authenticated, and RLS
-- then filters rows. We also take away the privileges we never use, so a
-- missing or wrong policy can't open up writes. A future direct-write policy
-- must re-grant the one privilege it needs, with a test.
revoke all on public.gyms, public.members, public.check_ins,
              public.closure_weeks, public.xp_ledger
  from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.gyms, public.members, public.check_ins,
     public.closure_weeks, public.xp_ledger
  from authenticated;
grant select on public.gyms, public.members, public.check_ins,
                public.closure_weeks, public.xp_ledger
  to authenticated;

-- Helpers for policies -------------------------------------------------------------
-- SECURITY DEFINER so a policy on members can look at members without
-- recursing into its own policy. search_path is empty so nothing can be
-- shadowed; every name is schema-qualified.

-- The caller's gym, whatever their status (null if they haven't joined).
create function public.my_gym_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.gym_id from public.members m where m.id = auth.uid()
$$;

-- The caller's gym, but only while they are ACTIVE staff or admin.
create function public.my_staff_gym_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.gym_id from public.members m
  where m.id = auth.uid() and m.status = 'active' and m.role in ('staff', 'admin')
$$;

-- Read policies ---------------------------------------------------------------------
create policy members_read_own on public.members
  for select to authenticated using (id = (select auth.uid()));
create policy members_read_by_staff on public.members
  for select to authenticated using (gym_id = (select public.my_staff_gym_id()));

create policy check_ins_read_own on public.check_ins
  for select to authenticated using (member_id = (select auth.uid()));
create policy check_ins_read_by_staff on public.check_ins
  for select to authenticated using (gym_id = (select public.my_staff_gym_id()));

create policy xp_ledger_read_own on public.xp_ledger
  for select to authenticated using (member_id = (select auth.uid()));
create policy xp_ledger_read_by_staff on public.xp_ledger
  for select to authenticated using (gym_id = (select public.my_staff_gym_id()));

-- Gym name and closure weeks are not private within the gym.
create policy gyms_read_own_gym on public.gyms
  for select to authenticated using (id = (select public.my_gym_id()));
create policy closure_weeks_read_own_gym on public.closure_weeks
  for select to authenticated using (gym_id = (select public.my_gym_id()));

-- Write functions ---------------------------------------------------------------------

-- Sign-up: the signed-in user joins the pilot gym as a PENDING member.
-- p_privacy_notice_version is the notice they ticked; it is required.
create function public.join_gym(
  p_full_name text,
  p_nickname text,
  p_show_on_tv boolean,
  p_privacy_notice_version text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_gym uuid;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_nick text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if nullif(btrim(coalesce(p_privacy_notice_version, '')), '') is null then
    raise exception 'Please agree to the privacy notice first';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'Please enter your full name (up to 80 characters)';
  end if;
  -- One pilot gym for now: the oldest gym row.
  select g.id into v_gym from public.gyms g order by g.created_at, g.id limit 1;
  if v_gym is null then
    raise exception 'No gym is set up yet';
  end if;

  insert into public.members
    (id, gym_id, full_name, nickname, show_on_tv,
     privacy_consent_at, privacy_notice_version)
  values
    (v_uid, v_gym, v_name, v_nick, coalesce(p_show_on_tv, false),
     now(), btrim(p_privacy_notice_version))
  -- A double tap on "Join" is harmless; it never changes an existing member.
  on conflict (id) do nothing;
end;
$$;

-- Profile: a member edits their own nickname and TV opt-in. The full name can
-- only change while pending, so staff approve the name they see in the logbook.
create function public.update_my_profile(
  p_full_name text,
  p_nickname text,
  p_show_on_tv boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  update public.members m set
    nickname   = nullif(btrim(coalesce(p_nickname, '')), ''),
    show_on_tv = coalesce(p_show_on_tv, false),
    full_name  = case
                   when m.status = 'pending' and char_length(v_name) between 1 and 80
                   then v_name else m.full_name
                 end
  where m.id = v_uid;
  if not found then
    raise exception 'Join the gym first';
  end if;
end;
$$;

-- Staff: approve (pending -> active), deactivate, or reactivate a member of
-- their own gym. Staff can only change plain members; admins can change
-- staff too. Nobody changes their own status.
create function public.set_member_status(p_member_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.members%rowtype;
  v_target public.members%rowtype;
begin
  select * into v_me from public.members
  where id = auth.uid() and status = 'active' and role in ('staff', 'admin');
  if not found then
    raise exception 'Staff only';
  end if;
  if p_status not in ('active', 'deactivated') then
    raise exception 'Unknown status %', p_status;
  end if;

  select * into v_target from public.members
  where id = p_member_id and gym_id = v_me.gym_id
  for update;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_target.id = v_me.id then
    raise exception 'You cannot change your own status';
  end if;
  if v_target.role <> 'member' and v_me.role <> 'admin' then
    raise exception 'Only an admin can change a staff account';
  end if;
  if v_target.role = 'admin' then
    raise exception 'Admins are changed in the Supabase dashboard';
  end if;

  update public.members set
    status      = p_status,
    approved_at = case when p_status = 'active' and approved_at is null
                       then now() else approved_at end,
    approved_by = case when p_status = 'active' and approved_at is null
                       then v_me.id else approved_by end
  where id = v_target.id;
end;
$$;

-- Admin: make an active member staff, or staff a plain member again. Admin
-- and display accounts are set up in the Supabase dashboard, never here.
create function public.set_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_me public.members%rowtype;
  v_target public.members%rowtype;
begin
  select * into v_me from public.members
  where id = auth.uid() and status = 'active' and role = 'admin';
  if not found then
    raise exception 'Admins only';
  end if;
  if p_role not in ('member', 'staff') then
    raise exception 'Role % is set up in the Supabase dashboard', p_role;
  end if;

  select * into v_target from public.members
  where id = p_member_id and gym_id = v_me.gym_id
  for update;
  if not found then
    raise exception 'Member not found';
  end if;
  if v_target.id = v_me.id or v_target.role not in ('member', 'staff') then
    raise exception 'This account''s role is changed in the Supabase dashboard';
  end if;
  if v_target.status <> 'active' then
    raise exception 'Approve the member first';
  end if;

  update public.members set role = p_role where id = v_target.id;
end;
$$;

-- Privacy: a signed-in user deletes their own account. Their member row,
-- check-ins and XP go with it through the foreign key cascades.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = v_uid;
end;
$$;

-- Function privileges ----------------------------------------------------------------
-- Postgres lets PUBLIC run new functions and Supabase also grants anon; only
-- signed-in users may call these.
revoke all on function
  public.my_gym_id(),
  public.my_staff_gym_id(),
  public.join_gym(text, text, boolean, text),
  public.update_my_profile(text, text, boolean),
  public.set_member_status(uuid, text),
  public.set_member_role(uuid, text),
  public.delete_my_account()
  from public, anon;
grant execute on function
  public.my_gym_id(),
  public.my_staff_gym_id(),
  public.join_gym(text, text, boolean, text),
  public.update_my_profile(text, text, boolean),
  public.set_member_status(uuid, text),
  public.set_member_role(uuid, text),
  public.delete_my_account()
  to authenticated;
-- The trigger function is never called directly.
revoke all on function public.xp_ledger_is_append_only() from public, anon, authenticated;
