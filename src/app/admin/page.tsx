import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export const metadata: Metadata = { title: `${APP_NAME} · Admin` };

const COMING = [
  ["Approve new sign-ups", "Week 2"],
  ["Deactivate a member", "Week 2"],
  ["Manual check-in by name", "Week 3"],
  ["Void a check-in", "Week 5"],
  ["Set the monthly visits goal", "Week 5"],
  ["Mark a closure week", "Week 5"],
] as const;

export default function AdminPage() {
  return (
    <main className="page page-wide">
      <p className="eyebrow">{APP_NAME}</p>
      <h1>Staff admin</h1>

      <div className="card notice">
        Staff sign-in arrives in week 2. These are the tools this page will hold.
      </div>

      <div className="card">
        <ul className="list">
          {COMING.map(([tool, week]) => (
            <li key={tool}>
              <span>{tool}</span>
              <span className="muted">{week}</span>
            </li>
          ))}
        </ul>
      </div>

      <nav className="nav">
        <Link href="/">Member app</Link>
        <Link href="/tv">TV screen</Link>
        <Link href="/api/health">Setup check</Link>
      </nav>
    </main>
  );
}
