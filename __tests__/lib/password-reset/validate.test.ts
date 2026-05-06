import { describe, it, expect } from "vitest";
import { validateResetTokenRecord } from "@/lib/password-reset/validate";

const NOW = new Date("2026-05-06T12:00:00Z");

describe("validateResetTokenRecord", () => {
  it("returns NOT_FOUND when record is null", () => {
    expect(validateResetTokenRecord(null, NOW)).toEqual({ valid: false, reason: "NOT_FOUND" });
  });

  it("returns USED when usedAt is set", () => {
    const record = {
      usedAt: new Date("2026-05-06T11:00:00Z"),
      expiresAt: new Date("2026-05-06T13:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: false, reason: "USED" });
  });

  it("returns EXPIRED when expiresAt is in the past", () => {
    const record = {
      usedAt: null,
      expiresAt: new Date("2026-05-06T11:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: false, reason: "EXPIRED" });
  });

  it("returns valid:true when token is fresh and unused", () => {
    const record = {
      usedAt: null,
      expiresAt: new Date("2026-05-06T13:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: true });
  });

  it("USED takes precedence over EXPIRED when both apply", () => {
    const record = {
      usedAt: new Date("2026-05-06T10:30:00Z"),
      expiresAt: new Date("2026-05-06T11:00:00Z"),
    };
    expect(validateResetTokenRecord(record, NOW)).toEqual({ valid: false, reason: "USED" });
  });
});
