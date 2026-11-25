# Gamified Gym

A free web app (PWA) for one gym: members scan a QR code on the gym TV to
check in, grow a weekly streak and level up. Three pages: member (`/`),
TV (`/tv`) and staff admin (`/admin`).

See [CLAUDE.md](CLAUDE.md) for the rules, stack and 8-week plan.

## One-time setup (about 15 minutes, all free)

### 1. Supabase (database and sign-in)

1. Sign up at [supabase.com](https://supabase.com) and create a project
   (region: Singapore is closest to the Philippines). Save the database
   password in your password manager.
2. Open **SQL Editor**, paste the contents of
   `supabase/migrations/20261125000000_initial_schema.sql`, and click **Run**.
   Then do the same with `supabase/seed.sql` (creates the pilot gym row).
3. Open **Project Settings > API** and keep the tab open: you need the
   **Project URL** and the **anon public** key in the next step.
   Do not share the `service_role` key with anyone, including in chat.

### 2. Vercel (hosting and PR previews)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account (Hobby plan).
2. **Add New > Project**, import `gamified-gym`, keep the defaults.
3. Before deploying, open **Environment Variables** and add, for all
   environments:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon public key
4. Deploy. Every pull request now gets its own preview link.

### 3. Check it

Open `https://<your-app>.vercel.app/api/health`. You should see
`{"ok":true,"supabase":"connected"}`. If not, the `hint` says what's missing.

## Local development (optional)

```bash
cp .env.example .env.local   # fill in the two NEXT_PUBLIC_ values
npm install
npm run dev                  # http://localhost:3000
npm test                     # rules engine tests
```

## Checks

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` run on
every pull request in GitHub Actions, plus a job that applies the migrations
to a throwaway Postgres and runs `supabase/tests/schema_rules.sql`.
