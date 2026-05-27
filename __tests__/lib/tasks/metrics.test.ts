import { describe, it, expect } from "vitest";
import { computeP50, computeP75, periodToDate } from "@/lib/tasks/metrics";

describe("computeP50 / computeP75", () => {
  it("returns null on empty input", () => {
    expect(computeP50([])).toBeNull();
    expect(computeP75([])).toBeNull();
  });
  it("returns single value for single input", () => {
    expect(computeP50([5])).toBe(5);
  });
  it("computes median for odd-length list", () => {
    expect(computeP50([1, 3, 7])).toBe(3);
  });
  it("computes interpolated median for even-length list", () => {
    expect(computeP50([1, 3, 5, 7])).toBe(4);
  });
  it("computes p75 close to upper quartile", () => {
    const v = computeP75([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(v).toBeGreaterThan(5);
    expect(v).toBeLessThanOrEqual(7);
  });
});

describe("periodToDate", () => {
  it("returns ~30 days ago for 30d", () => {
    const now = new Date("2026-05-06T00:00:00Z");
    const r = periodToDate("30d", now);
    expect(r.toISOString()).toBe("2026-04-06T00:00:00.000Z");
  });
  it("returns ~365 days ago for 12m", () => {
    const now = new Date("2026-05-06T00:00:00Z");
    const r = periodToDate("12m", now);
    expect(r.toISOString()).toBe("2025-05-06T00:00:00.000Z");
  });
});
