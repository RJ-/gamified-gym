import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { APP_NAME } from "@/lib/config";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: `${APP_NAME} · Sign in` };

export default function LoginPage() {
  return (
    <main className="page">
      <p className="eyebrow">{APP_NAME}</p>
      <h1>Sign in</h1>
      <p className="muted">
        No password needed. New here? Signing in creates your account, then the front desk
        approves it once.
      </p>
      <Suspense fallback={<div className="card muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
      <nav className="nav">
        <Link href="/">Home</Link>
        <Link href="/privacy">Privacy notice</Link>
      </nav>
    </main>
  );
}
