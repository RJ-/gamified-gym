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

## Week 2 setup: sign-in and staff approval (about 30 minutes)

Do these in order. Nothing here goes in chat or in the repo; it all lives in
the Supabase, Google and Vercel dashboards.

### A. Database

In Supabase **SQL Editor**, paste and **Run**
`supabase/migrations/20261126000000_sign_up_approval_rls.sql`.

### B. Sign-in return links

Supabase **Authentication > URL Configuration**:

- **Site URL**: `https://gamified-gym.vercel.app`
- **Redirect URLs** (add all three):
  - `https://gamified-gym.vercel.app/**`
  - `https://gamified-gym-*-parsu.vercel.app/**` (PR previews)
  - `http://localhost:3000/**`

### C. Sign-in emails

1. Supabase's built-in email sender only delivers to your own Supabase team
   and only a few per hour, so members won't get links until you add your own
   sender. Free option: a Gmail account with an **app password** (Google
   Account > Security > 2-Step Verification > App passwords), about 500
   emails a day. In Supabase **Authentication > Emails > SMTP Settings**, turn
   on custom SMTP: host `smtp.gmail.com`, port `465`, username = the Gmail
   address, password = the app password, sender name = the gym's name.
2. Then in **Authentication > Rate Limits**, set emails per hour to about 60.
3. In **Authentication > Emails > Templates**, replace the body of both
   **Magic Link** and **Confirm signup** with the template below. Its link
   works even when the email app opens it in a different browser, and the code
   lets members type it into the app instead.

```html
<h2>Sign in to the gym app</h2>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Tap here to sign in</a></p>
<p>Or type this code in the app: <strong>{{ .Token }}</strong></p>
<p>If you didn't ask for this, you can ignore this email.</p>
```

### D. Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com): create a
   project, then **APIs & Services > OAuth consent screen**: External, app
   name = the gym's name, your email as support contact. Under **Audience**,
   click **Publish app** (in "Testing" mode only 100 listed test users can
   sign in).
2. **APIs & Services > Credentials > Create credentials > OAuth client ID**,
   type **Web application**. Under **Authorized redirect URIs** add
   `https://<your-project-ref>.supabase.co/auth/v1/callback` (Supabase shows
   this exact URL on its Google provider page).
3. Copy the Client ID and Client secret into Supabase **Authentication >
   Sign In / Providers > Google**, and enable it.

### E. Make yourself the admin

1. Open the app, sign in, and fill in the Join form.
2. In Supabase **SQL Editor**, run (with your email):

```sql
update public.members
set role = 'admin', status = 'active', approved_at = now()
where id = (select id from auth.users where email = 'you@example.com');
```

3. Open `/admin`. You can approve members, deactivate them, and make
   front-desk staff (they then use `/admin` from their own phone).

### F. Vercel

- **Settings > Git > Production Branch** must be `main`.
- `vercel.json` runs the server in Singapore (`sin1`), next to the database.

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
to a throwaway Postgres and runs `supabase/tests/schema_rules.sql` and
`supabase/tests/rls_policies.sql` (who can read and write what).
