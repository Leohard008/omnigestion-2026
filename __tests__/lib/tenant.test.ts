import { describe, it, expect, vi } from "vitest";
import { getTenantContext } from "@/lib/tenant";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    organizationMember: { findFirst: vi.fn() },
    teamMember: { findMany: vi.fn() },
  },
}));

describe("getTenantContext", () => {
  it("returns null if no session", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue(null);
    const ctx = await getTenantContext();
    expect(ctx).toBeNull();
  });

  it("returns null if no active membership", async () => {
    const { auth } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (db.organizationMember.findFirst as any).mockResolvedValue(null);
    const ctx = await getTenantContext();
    expect(ctx).toBeNull();
  });

  it("returns tenant context with team roles", async () => {
    const { auth } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    (auth as any).mockResolvedValue({ user: { id: "u1" } });
    (db.organizationMember.findFirst as any).mockResolvedValue({
      organizationId: "org1",
      role: "MEMBER",
    });
    (db.teamMember.findMany as any).mockResolvedValue([
      { teamId: "t1", role: "MANAGER" },
      { teamId: "t2", role: "MEMBER" },
    ]);

    const ctx = await getTenantContext();
    expect(ctx).toEqual({
      userId: "u1",
      orgId: "org1",
      orgRole: "MEMBER",
      teamRoles: new Map([
        ["t1", "MANAGER"],
        ["t2", "MEMBER"],
      ]),
    });
  });
});
