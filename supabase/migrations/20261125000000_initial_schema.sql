-- Week 1: core tables for the Gamified Gym MVP.
--
-- Rules these tables encode (see CLAUDE.md, "Game rules"):
--   * one COUNTED check-in per member per calendar day, Asia/Manila time;
--     extra scans are still recorded with counted = false
--   * xp_ledger is append-only; (member_id, kind, ref) is unique for
--     automatic grants, so every XP job is safe to re-run
--   * streaks are computed from check_ins, never stored
--
-- Row Level Security is ON for every table with no policies yet, so only the
-- service role (server code) can read or write. Week 2 adds member, staff and
-- display policies.

create extension if not exists pgcrypto;

-- Gyms -----------------------------------------------------------------------
create table public.gyms (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  time_zone          text not null default 'Asia/Manila',
  -- Shared monthly visits goal shown on the TV (status only, no prizes).
  monthly_visit_goal integer not null default 0 check (monthly_visit_goal >= 0),
  created_at         timestamptz not null default now()
);

-- Members --------------------------------------------------------------------
-- One row per signed-in person, linked to Supabase Auth. Staff approve each
-- sign-up once (pending -> active) and can deactivate. Membership itself stays
-- in the gym's paper logbook.
create table public.members (
  id             uuid primary key references auth.users (id) on delete cascade,
  gym_id         uuid not null references public.gyms (id),
  full_name      text not null default '',
  -- Shown on the TV only when show_on_tv is true.
  nickname       text check (char_length(nickname) <= 24),
  show_on_tv     boolean not null default false,
  weekly_target  smallint not null default 3 check (weekly_target between 2 and 4),
  role           text not null default 'member'
                   check (role in ('member', 'staff', 'admin', 'display')),
  status         text not null default 'pending'
                   check (status in ('pending', 'active', 'deactivated')),
  privacy_consent_at timestamptz,
  approved_at    timestamptz,
  approved_by    uuid references public.members (id),
  created_at     timestamptz not null default now()
);

create index members_gym_status_idx on public.members (gym_id, status);

-- Check-ins ------------------------------------------------------------------
create table public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms (id),
  member_id     uuid not null references public.members (id) on delete cascade,
  -- When the member scanned (for offline scans: the time carried by the code).
  checked_in_at timestamptz not null,
  -- Manila calendar day of checked_in_at, written by the server.
  day_key       date not null,
  counted       boolean not null,
  method        text not null check (method in ('qr', 'manual')),
  -- Idempotency key from the phone, so a queued scan sent twice saves once.
  client_ref    uuid unique,
  created_by    uuid references public.members (id),
  manual_reason text,
  voided_at     timestamptz,
  voided_by     uuid references public.members (id),
  void_reason   text,
  created_at    timestamptz not null default now(),
  constraint check_ins_day_key_is_manila
    check (day_key = (checked_in_at at time zone 'Asia/Manila')::date),
  constraint check_ins_manual_needs_reason
    check (method <> 'manual' or manual_reason is not null),
  constraint check_ins_void_needs_reason
    check (voided_at is null or void_reason is not null)
);

-- At most one counted, non-voided check-in per member per day.
create unique index check_ins_one_counted_per_day
  on public.check_ins (member_id, day_key)
  where counted and voided_at is null;

create index check_ins_gym_day_idx on public.check_ins (gym_id, day_key);
create index check_ins_member_time_idx on public.check_ins (member_id, checked_in_at);

-- Closure weeks --------------------------------------------------------------
-- Weeks the gym marks as closed (Holy Week, Christmas) so they don't break
-- streaks. week_start is always a Monday.
create table public.closure_weeks (
  gym_id     uuid not null references public.gyms (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  reason     text not null default '',
  created_at timestamptz not null default now(),
  primary key (gym_id, week_start)
);

-- XP ledger ------------------------------------------------------------------
create table public.xp_ledger (
  id         bigint generated always as identity primary key,
  gym_id     uuid not null references public.gyms (id),
  member_id  uuid not null references public.members (id) on delete cascade,
  amount     integer not null,
  kind       text not null check (kind in ('check_in', 'weekly_bonus', 'adjustment')),
  -- check_in: the day (YYYY-MM-DD); weekly_bonus: the week's Monday.
  ref        text,
  reason     text,
  created_by uuid references public.members (id),
  created_at timestamptz not null default now(),
  constraint xp_ledger_auto_needs_ref
    check (kind = 'adjustment' or ref is not null),
  constraint xp_ledger_adjustment_needs_reason
    check (kind <> 'adjustment' or reason is not null)
);

create unique index xp_ledger_one_grant_per_ref
  on public.xp_ledger (member_id, kind, ref)
  where kind <> 'adjustment';

create index xp_ledger_member_idx on public.xp_ledger (member_id);

-- Ledger rows are never edited or deleted; corrections are new adjustments.
-- The one exception is deleting a member's account (privacy law), which
-- removes their rows through the foreign key cascade (trigger depth > 1).
create function public.xp_ledger_is_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'xp_ledger is append-only; add an adjustment row instead';
end;
$$;

create trigger xp_ledger_no_update_or_delete
  before update or delete on public.xp_ledger
  for each row execute function public.xp_ledger_is_append_only();

-- Lock everything down until week 2 adds policies -----------------------------
alter table public.gyms          enable row level security;
alter table public.members       enable row level security;
alter table public.check_ins     enable row level security;
alter table public.closure_weeks enable row level security;
alter table public.xp_ledger     enable row level security;
