import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TeamRole } from "@prisma/client";
import { transitionStatus } from "@/lib/tasks/transitions";

vi.mock("@/lib/db", () => {
  const tx = {
    taskEvent: { create: vi.fn() },
    task: { update: vi.fn(), findUnique: vi.fn() },
    timerSession: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return {
    db: {
      $transaction: vi.fn(async (fn: any) => fn(tx)),
      _tx: tx,
    },
  };
});

describe("transitionStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid transitions", async () => {
    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "OWNER" as const,
      teamRoles: new Map(),
    };
    const task = {
      id: "t1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "TODO" as const,
      startedAt: null, completedAt: null,
    };
    await expect(
      transitionStatus(ctx, task as any, "DONE")
    ).rejects.toThrow(/transition/i);
  });

  it("creates STATUS_CHANGE event and updates task on TODO → IN_PROGRESS", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    tx.timerSession.findFirst.mockResolvedValue(null);

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, TeamRole>([["team1", "MEMBER"]]),
    };
    const task = {
      id: "t1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "TODO" as const,
      startedAt: null, completedAt: null,
    };

    await transitionStatus(ctx, task as any, "IN_PROGRESS");

    expect(tx.taskEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: "t1",
        eventType: "STATUS_CHANGE",
        fromStatus: "TODO",
        toStatus: "IN_PROGRESS",
        byUserId: "u1",
      }),
    });
    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({
        status: "IN_PROGRESS",
        startedAt: expect.any(Date),
      }),
    });
    expect(tx.timerSession.create).toHaveBeenCalled();
  });

  it("stops other active timer when starting a new task", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    tx.timerSession.findFirst
      .mockResolvedValueOnce({
        id: "sess-other", taskId: "tOther", userId: "u1",
        startedAt: new Date(Date.now() - 1000 * 60 * 30),
      })
      .mockResolvedValueOnce(null);

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, TeamRole>([["team1", "MEMBER"]]),
    };
    const task = {
      id: "t1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "TODO" as const,
      startedAt: null, completedAt: null,
    };

    await transitionStatus(ctx, task as any, "IN_PROGRESS");
    expect(tx.timerSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess-other" },
        data: expect.objectContaining({ endedAt: expect.any(Date), durationSeconds: expect.any(Number) }),
      })
    );
    expect(tx.timerSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", taskId: "t1" }),
      })
    );
  });

  it("closes active timer on IN_PROGRESS → BLOCKED with editLockedAt = endedAt + 24h", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    const startedAt = new Date(Date.now() - 1000 * 60 * 60);
    tx.timerSession.findFirst.mockResolvedValue({
      id: "sess1", taskId: "t1", userId: "u1", startedAt,
    });

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, TeamRole>([["team1", "MEMBER"]]),
    };
    const task = {
      id: "t1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "IN_PROGRESS" as const,
      startedAt, completedAt: null,
    };

    await transitionStatus(ctx, task as any, "BLOCKED", "waiting on supplier");

    const updateCall = tx.timerSession.update.mock.calls[0][0];
    expect(updateCall.data.endedAt).toBeInstanceOf(Date);
    expect(updateCall.data.editLockedAt.getTime() - updateCall.data.endedAt.getTime()).toBe(
      24 * 60 * 60 * 1000
    );
    expect(tx.taskEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toStatus: "BLOCKED",
        reason: "waiting on supplier",
      }),
    });
  });

  it("sets task.completedAt on IN_PROGRESS → DONE", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    tx.timerSession.findFirst.mockResolvedValue(null);

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, TeamRole>([["team1", "MEMBER"]]),
    };
    const task = {
      id: "t1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "IN_PROGRESS" as const,
      startedAt: new Date(), completedAt: null,
    };

    await transitionStatus(ctx, task as any, "DONE");
    expect(tx.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: expect.objectContaining({ status: "DONE", completedAt: expect.any(Date) }),
    });
  });

  it("closes active timer on IN_PROGRESS → DONE", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    const startedAt = new Date(Date.now() - 1000 * 60 * 60);
    tx.timerSession.findFirst.mockResolvedValue({
      id: "sess1", taskId: "t1", userId: "u1", startedAt,
    });

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, "MANAGER" | "MEMBER">([["team1", "MEMBER"]]),
    };
    const task = {
      id: "t1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "IN_PROGRESS" as const,
      startedAt, completedAt: null,
    };

    await transitionStatus(ctx, task as any, "DONE");

    expect(tx.timerSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess1" },
        data: expect.objectContaining({ endedAt: expect.any(Date), durationSeconds: expect.any(Number) }),
      })
    );
  });

  it("does not create timer if user is not the assignee", async () => {
    const { db } = await import("@/lib/db");
    const tx = (db as any)._tx;
    tx.timerSession.findFirst.mockResolvedValue(null);

    // Manager (not assignee) starts the task on behalf of someone.
    const ctx = {
      userId: "mgr1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map<string, "MANAGER" | "MEMBER">([["team1", "MANAGER"]]),
    };
    const task = {
      id: "t1", organizationId: "org1", teamId: "team1",
      assigneeId: "u1", status: "TODO" as const,  // assignee is u1, not mgr1
      startedAt: null, completedAt: null,
    };

    await transitionStatus(ctx, task as any, "IN_PROGRESS");

    expect(tx.timerSession.create).not.toHaveBeenCalled();
  });
});
