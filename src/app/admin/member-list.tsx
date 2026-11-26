"use client";

import { useState, useTransition } from "react";
import type { Member } from "@/lib/auth";
import { setMemberRole, setMemberStatus } from "./actions";

type Row = Pick<Member, "id" | "full_name" | "nickname" | "role" | "status" | "created_at">;

function joinedOn(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  });
}

function MemberRow({ m, myId, isAdmin }: { m: Row; myId: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; message: string } | null>) =>
    start(async () => {
      const res = await fn();
      setError(res && !res.ok ? res.message : "");
    });

  const isMe = m.id === myId;
  const canChange = !isMe && m.role !== "admin" && m.role !== "display" && (isAdmin || m.role === "member");

  return (
    <li className="member-row">
      <div>
        <strong>{m.full_name || "(no name)"}</strong>
        {m.nickname && <span className="muted"> · {m.nickname}</span>}
        {m.role !== "member" && <span className="badge">{m.role}</span>}
        {isMe && <span className="badge">you</span>}
        <div className="muted small">Joined {joinedOn(m.created_at)}</div>
        {error && <div className="error small">{error}</div>}
      </div>
      {canChange && (
        <div className="row-actions">
          {m.status === "pending" && (
            <button className="button small-button" disabled={pending} onClick={() => run(() => setMemberStatus(m.id, "active"))}>
              Approve
            </button>
          )}
          {m.status === "pending" && (
            <button className="link-button small" disabled={pending} onClick={() => run(() => setMemberStatus(m.id, "deactivated"))}>
              Not a member
            </button>
          )}
          {m.status === "active" && (
            <button className="button button-secondary small-button" disabled={pending} onClick={() => run(() => setMemberStatus(m.id, "deactivated"))}>
              Deactivate
            </button>
          )}
          {m.status === "deactivated" && (
            <button className="button button-secondary small-button" disabled={pending} onClick={() => run(() => setMemberStatus(m.id, "active"))}>
              Reactivate
            </button>
          )}
          {isAdmin && m.status === "active" && (
            <button
              className="link-button small"
              disabled={pending}
              onClick={() => run(() => setMemberRole(m.id, m.role === "staff" ? "member" : "staff"))}
            >
              {m.role === "staff" ? "Remove staff" : "Make staff"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function MemberList({ members, myId, isAdmin }: { members: Row[]; myId: string; isAdmin: boolean }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const match = (m: Row) =>
    !needle || m.full_name.toLowerCase().includes(needle) || (m.nickname ?? "").toLowerCase().includes(needle);

  const pending = members.filter((m) => m.status === "pending");
  const others = members.filter((m) => m.status !== "pending" && match(m));
  const active = others.filter((m) => m.status === "active");
  const off = others.filter((m) => m.status === "deactivated");

  const section = (title: string, rows: Row[], empty: string) => (
    <div className="card">
      <p className="eyebrow">
        {title} ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>{empty}</p>
      ) : (
        <ul className="list">
          {rows.map((m) => (
            <MemberRow key={m.id} m={m} myId={myId} isAdmin={isAdmin} />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      {section("Waiting for approval", pending, "No one is waiting. New sign-ups show up here.")}
      <input
        className="search"
        type="search"
        placeholder="Search members by name"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search members by name"
      />
      {section("Active", active, needle ? "No match." : "No active members yet.")}
      {off.length > 0 && section("Deactivated", off, "")}
    </>
  );
}
