import { describe, it, expect, vi, beforeEach } from "vitest";
import { editTimerSession, TimerError } from "@/lib/tasks/timer";

vi.mock("@/lib/db", () => {
  const tx = {
    timerSession: { findFirst: vi.fn(), update: vi.fn() },
    timerSessionEdit: { create: vi.fn() },
  };
  return { db: { $transaction: vi.fn(async (fn: any) => fn(tx)), _tx: tx } };
});

describe("editTimerSession", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates audit edit row with old/new values", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    const startedAt = new Date("2026-05-01T10:00:00Z");
    const endedAt = new Date("2026-05-01T12:00:00Z");
    tx.timerSession.findFirst.mockResolvedValue({
      id: "sess1", userId: "u1", taskId: "task1",
      startedAt, endedAt, durationSeconds: 7200,
      editLockedAt: new Date(Date.now() + 1000 * 60 * 60),
    });

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, "MANAGER" | "MEMBER">([["team1", "MEMBER"]]),
    };
    const task = {
      id: "task1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "DONE" as const,
    };

    await editTimerSession(ctx, "sess1", task as any, {
      newStartedAt: startedAt,
      newEndedAt: new Date("2026-05-01T11:00:00Z"),
      reason: "forgot to stop",
    });

    expect(tx.timerSessionEdit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: "sess1",
        editedById: "u1",
        oldDurationSec: 7200,
        newDurationSec: 3600,
        reason: "forgot to stop",
      }),
    });
    expect(tx.timerSession.update).toHaveBeenCalledWith({
      where: { id: "sess1" },
      data: expect.objectContaining({
        startedAt,
        endedAt: new Date("2026-05-01T11:00:00Z"),
        durationSeconds: 3600,
        isEdited: true,
      }),
    });
  });

  it("rejects MEMBER edit after 24h window", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    tx.timerSession.findFirst.mockResolvedValue({
      id: "sess1", userId: "u1", taskId: "task1",
      startedAt: new Date(), endedAt: new Date(),
      editLockedAt: new Date(Date.now() - 1000), // expired
    });

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, "MANAGER" | "MEMBER">([["team1", "MEMBER"]]),
    };
    const task = { id: "task1", organizationId: "org1", teamId: "team1", assigneeId: "u1", status: "DONE" as const };

    await expect(
      editTimerSession(ctx, "sess1", task as any, { reason: "x" })
    ).rejects.toThrow(/window/i);
  });

  it("allows MANAGER edit after 24h window", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    tx.timerSession.findFirst.mockResolvedValue({
      id: "sess1", userId: "u1", taskId: "task1",
      startedAt: new Date("2026-05-01T10:00:00Z"),
      endedAt: new Date("2026-05-01T12:00:00Z"),
      durationSeconds: 7200,
      editLockedAt: new Date(Date.now() - 1000),
    });
    const ctx = {
      userId: "mgr1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, "MANAGER" | "MEMBER">([["team1", "MANAGER"]]),
    };
    const task = { id: "task1", organizationId: "org1", teamId: "team1", assigneeId: "u1", status: "DONE" as const };

    await expect(
      editTimerSession(ctx, "sess1", task as any, {
        newEndedAt: new Date("2026-05-01T11:00:00Z"),
        reason: "correction",
      })
    ).resolves.toBeUndefined();
  });
});
