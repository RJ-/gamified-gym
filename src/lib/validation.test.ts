import { describe, expect, it } from "vitest";
import {
  checkEmail,
  checkFullName,
  checkNickname,
  checkOtpCode,
  safeNextPath,
} from "./validation";

describe("safeNextPath", () => {
  it.each([
    ["/", "/"],
    ["/admin", "/admin"],
    ["/profile?x=1", "/profile?x=1"],
    ["https://evil.example", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["javascript:alert(1)", "/"],
    ["/ok\nSet-Cookie:x", "/"],
    ["", "/"],
    [undefined, "/"],
    [42, "/"],
  ])("%j -> %j", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("checkNickname", () => {
  it("allows empty (no nickname) and trims", () => {
    expect(checkNickname("  ")).toEqual({ ok: true, value: null });
    expect(checkNickname("  Jay  ")).toEqual({ ok: true, value: "Jay" });
  });
  it("allows Filipino names and simple punctuation", () => {
    expect(checkNickname("Niño_23")).toEqual({ ok: true, value: "Niño_23" });
    expect(checkNickname("Ma'am J-Lo")).toEqual({ ok: true, value: "Ma'am J-Lo" });
  });
  it("rejects long, HTML-ish or emoji nicknames", () => {
    expect(checkNickname("x".repeat(25)).ok).toBe(false);
    expect(checkNickname("<script>").ok).toBe(false);
    expect(checkNickname("gym 💪").ok).toBe(false);
  });
});

describe("checkFullName", () => {
  it("requires a name and collapses spaces", () => {
    expect(checkFullName(" ").ok).toBe(false);
    expect(checkFullName(" Juan   dela Cruz ")).toEqual({ ok: true, value: "Juan dela Cruz" });
  });
  it("rejects names over 80 characters", () => {
    expect(checkFullName("a".repeat(81)).ok).toBe(false);
  });
});

describe("checkEmail / checkOtpCode", () => {
  it("normalises emails", () => {
    expect(checkEmail(" Jay@Example.COM ")).toEqual({ ok: true, value: "jay@example.com" });
    expect(checkEmail("not-an-email").ok).toBe(false);
  });
  it("accepts 6 to 8 digit codes", () => {
    expect(checkOtpCode("123 456")).toEqual({ ok: true, value: "123456" });
    expect(checkOtpCode("12345").ok).toBe(false);
    expect(checkOtpCode("abcdef").ok).toBe(false);
  });
});
