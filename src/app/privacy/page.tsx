import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

export const metadata: Metadata = { title: `${APP_NAME} · Privacy notice` };

// Plain-language notice under the Philippine Data Privacy Act (RA 10173).
// If you change what it says, bump PRIVACY_NOTICE_VERSION in src/lib/privacy.ts.
export default function PrivacyPage() {
  return (
    <main className="page prose">
      <p className="eyebrow">{APP_NAME}</p>
      <h1>Privacy notice</h1>
      <p className="muted small">Version {PRIVACY_NOTICE_VERSION}</p>

      <h2>What we collect</h2>
      <ul>
        <li>Your email address (to sign you in). If you use Google, we only get your email and name from Google.</li>
        <li>Your full name, so staff can match you with the gym logbook.</li>
        <li>An optional nickname, and whether you want it shown on the gym TV.</li>
        <li>Your check-ins (date and time) and the XP, streak and level worked out from them.</li>
      </ul>
      <p>We don&apos;t collect your phone number, location, photos or payment details.</p>

      <h2>Why</h2>
      <p>
        Only to run this app: sign you in, record your gym visits, and show your streak, XP and
        level. There are no ads, no tracking tools, and we never sell or share your data.
      </p>

      <h2>Who can see it</h2>
      <ul>
        <li>You can see your own data.</li>
        <li>Gym staff can see members&apos; names and check-ins to approve accounts and fix mistakes.</li>
        <li>
          Other members see nothing about you, unless you turn on &quot;Show me on the TV&quot;. Then
          your nickname (never your full name) can appear on the gym TV.
        </li>
      </ul>

      <h2>Where it is kept</h2>
      <p>
        On Supabase (database and sign-in) and Vercel (website hosting). Both
        protect data in transit with encryption.
      </p>

      <h2>Your rights</h2>
      <p>
        You can see and change your nickname and TV setting on your <Link href="/profile">profile</Link>,
        and delete your account there at any time. Deleting removes your profile, check-ins,
        streak and XP for good. For anything else, including a copy of your data or a
        complaint, talk to the gym owner at the front desk. You can also contact the National
        Privacy Commission (privacy.gov.ph).
      </p>

      <h2>How long</h2>
      <p>Until you delete your account, or the gym stops using this app.</p>

      <nav className="nav">
        <Link href="/">Home</Link>
      </nav>
    </main>
  );
}
