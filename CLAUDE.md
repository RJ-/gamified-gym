@AGENTS.md

# Gamified Gym: working notes for Claude

A free, community-driven gamified gym web app for one pilot gym in the
Philippines. Members scan a rotating QR on the gym TV to check in, grow a
weekly streak, and earn XP and levels (status only). The owner (repo owner)
vibe codes: Claude builds, the owner tests Vercel previews on a phone and the
gym TV and reviews PRs. Keep everything simple enough for that loop.

Full plan and rationale: "Gamified Gym: Workplan Review & Lean Web-App MVP
Plan" (Claude Doc, https://claude.ai/artifact/1pCttFVxRMpEBVUALeswfL).

## Stack (free tier only)

- Next.js (App Router, TypeScript) as one installable PWA. This Next.js
  version differs from older training data: read `node_modules/next/dist/docs/`
  before using an API you are unsure of (see AGENTS.md).
- Supabase Free: Postgres, Auth (email magic link + Google; no SMS, it costs
  money), Realtime, cron.
- Vercel Hobby for hosting and PR previews. Hobby is non-commercial; move to
  Netlify or Cloudflare Pages if the gym ever pays.
- Vitest for unit tests. No paid services, no analytics SDKs.

## Pages

| Route    | Who            | Purpose |
|----------|----------------|---------|
| `/`      | members        | Sign in, Scan to check in, "2 of 3 this week", streak, XP, level, nickname, TV opt-in |
| `/tv`    | display account| Rotating 30 s QR, welcome banner (opt-in), today's count, monthly goal bar, top streaks |
| `/admin` | staff / admin  | Approve sign-ups, deactivate, manual check-in, void check-in, monthly goal, closure weeks |
| `/login` | anyone         | Email link or code, or Google |
| `/profile` | members      | Nickname, TV opt-in, sign out, delete account |
| `/privacy` | anyone       | Privacy notice (RA 10173) |
| `/api/health` | anyone    | Setup check: Supabase keys set and schema applied. Reveals no data |

## Gym constraints (from the owner)

- No kiosk or tablet. The gym TV (browser) is the check-in point.
- Membership lives only in the paper logbook. Staff approve each app sign-up
  once (`pending` -> `active`) and can deactivate. No membership expiry logic.
- No real-world rewards. XP and levels are status only.
- Members are mostly on low-end Android with prepaid data; gym Wi-Fi is flaky.

## Game rules (source of truth: `src/lib/rules/`)

- Time zone is always Asia/Manila (UTC+8, no DST). Never use `Date#getDay()`
  etc. directly; use the helpers in `src/lib/rules/time.ts`.
- One **counted** check-in per member per calendar day. Extra scans are
  recorded with `counted = false`. A voided check-in frees the day.
- Check-in: +50 XP per counted day.
- Weekly target: 2 to 4 sessions (default 3), per member. Week = Monday 00:00
  to Sunday 23:59 Manila.
- Weekly target met: +150 XP, granted by a job at Monday 00:05 that is safe
  to run twice.
- Streak = consecutive weeks with the target met, computed from check-ins and
  never stored. The current week adds once met and never breaks the streak
  while in progress. Closure weeks (admin-marked) are skipped. The member's
  first week counts if met and is skipped if not.
- Level = floor(XP / 500) + 1.
- TV names are opt-in (nickname), off by default.

Any rule change: update `src/lib/rules/`, its tests, this section, and the
plan doc in the same PR.

## Database

- Schema lives in `supabase/migrations/*.sql` (timestamped, append-only: add a
  new migration, never edit one that has been applied).
- Every table has RLS enabled. Policies are SELECT-only: own rows, plus the
  whole gym for active staff/admin. The browser never writes tables directly:
  every write is a `security definer` function with `set search_path = ''`
  that checks the caller (`join_gym`, `update_my_profile`,
  `set_member_status`, `set_member_role`, `delete_my_account`). anon gets no
  table or function access. New policies or functions need a test in
  `supabase/tests/rls_policies.sql`.
- No service role key in the app. Server code uses the user's session
  (`src/lib/supabase/server.ts`), so RLS always applies.
- Roles: `member`, `staff` (approve/deactivate members), `admin` (also
  staff/member roles; set in the SQL editor), `display` (TV, week 3).
- `xp_ledger` is append-only (trigger). Corrections are `adjustment` rows with
  a reason. `(member_id, kind, ref)` is unique for automatic grants.
- `supabase/tests/schema_rules.sql` checks constraints and
  `supabase/tests/rls_policies.sql` checks access, on plain Postgres in CI
  (`supabase/tests/auth_stub.sql` fakes Supabase's roles and `auth.uid()`).
  Add a check for every new database rule.

## Auth

- Email magic link / code and Google, via `@supabase/ssr` with httpOnly
  cookies. `src/proxy.ts` refreshes the session; `getViewer()` in
  `src/lib/auth.ts` says who is looking. Both links land on `/auth/callback`
  (`code` or `token_hash`); `next` goes through `safeNextPath`.
- Every Server Action re-checks the session; the database checks again.
- Sign-up = sign in + Join form (full name, optional nickname, TV opt-in,
  privacy consent with `PRIVACY_NOTICE_VERSION`). New members are `pending`.

## Workflow rules

- One PR per plan week, from a feature branch, with a Vercel preview link and
  a short "how to test on your phone / TV" list. Ask the owner before merging.
- Real tests for streak, XP and check-in rules (`npm test`). Pure functions in
  `src/lib/rules/` with table-driven cases for midnight, Sunday 11:59 PM,
  closure weeks and double scans.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build`.
- **Never commit keys.** `.env*` is git-ignored except `.env.example`. Public
  keys go in Vercel env vars; the service role key is server-only.
- Don't ask the owner to paste secrets in chat. Tell them where to set them.
- Privacy (Philippine Data Privacy Act, RA 10173): collect only what's needed,
  record consent at sign-up, support account deletion (FK cascades), keep
  attendance private except opt-in TV names.
- Plain, friendly copy; Taglish is fine where it reads more naturally.

## Plan (8 weeks)

| Week | Focus | Done when |
|------|-------|-----------|
| 1 | Rules + setup: repo, CLAUDE.md, Supabase + Vercel, core tables, rules engine + tests | App deploys; owner agrees to rules |
| 2 | Sign-in + admin: email/Google sign-in, profile (nickname, TV opt-in), privacy notice + consent, approve/deactivate, RLS | A member signs up; staff approve in one tap |
| 3 | TV check-in: display account, rotating 30 s QR on `/tv`, Scan to check in, one counted per day, offline save-and-send, manual check-in | Scan-to-confirm < 3 s from 2 m; works with data off |
| 4 | XP + streaks: ledger entries on check-in, weekly bonus cron, member home live | Edge-case tests pass |
| 5 | TV dashboard + admin tools: Realtime banner, today's count, monthly goal, top streaks, void check-in, set goal | Readable across the gym; scan shows within 2 s |
| 6 | Buffer + staff trial; weekly DB backup via GitHub Action | A full week with no failed scans |
| 7 | Soft launch with 20 to 30 founding members | 70%+ of their visits scanned |
| 8 | Full launch | Baseline vs launch numbers recorded |

Post-launch, in order: workout logger, badges, squads lite, buddy bonus,
co-op challenges, feed, push/NFC/payments.
