import { db } from "@/lib/db";
import type { TaskStatus, Prisma } from "@prisma/client";
import type { TenantContext, TaskRef } from "@/lib/tasks/types";
import { canTransitionStatus } from "@/lib/tasks/permissions";
import { TIMER_EDIT_WINDOW_HOURS } from "@/lib/tasks/constants";

export class TransitionError extends Error {
  code: "FORBIDDEN" | "INVALID_TRANSITION" | "NOT_FOUND";
  constructor(code: "FORBIDDEN" | "INVALID_TRANSITION" | "NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

export async function transitionStatus(
  ctx: TenantContext,
  task: TaskRef,
  toStatus: TaskStatus,
  reason?: string
): Promise<void> {
  if (!canTransitionStatus(ctx, task, task.status, toStatus)) {
    // Distinguish invalid transition vs forbidden role.
    const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
      TODO: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["BLOCKED", "DONE", "CANCELLED"],
      BLOCKED: ["IN_PROGRESS", "CANCELLED"],
      DONE: [],
      CANCELLED: [],
    };
    if (!ALLOWED[task.status].includes(toStatus)) {
      throw new TransitionError("INVALID_TRANSITION", `Cannot transition ${task.status} → ${toStatus}`);
    }
    throw new TransitionError("FORBIDDEN", "Insufficient permissions for transition");
  }

  await db.$transaction(async (tx) => {
    const now = new Date();

    await tx.taskEvent.create({
      data: {
        taskId: task.id,
        eventType: "STATUS_CHANGE",
        fromStatus: task.status,
        toStatus,
        byUserId: ctx.userId,
        at: now,
        reason: reason ?? null,
      },
    });

    const updateData: Prisma.TaskUpdateInput = { status: toStatus };
    if (toStatus === "IN_PROGRESS" && !task.startedAt) {
      updateData.startedAt = now;
    }
    if (toStatus === "DONE") {
      updateData.completedAt = now;
    }

    await tx.task.update({ where: { id: task.id }, data: updateData });

    // Timer side-effects: only the assignee carries a timer for their task.
    if (toStatus === "IN_PROGRESS" && task.assigneeId === ctx.userId) {
      // Stop any other active session for this user (single timer policy).
      const activeOther = await tx.timerSession.findFirst({
        where: { userId: ctx.userId, endedAt: null, taskId: { not: task.id } },
      });
      if (activeOther) {
        const ended = now;
        const dur = Math.floor((ended.getTime() - activeOther.startedAt.getTime()) / 1000);
        await tx.timerSession.update({
          where: { id: activeOther.id },
          data: {
            endedAt: ended,
            durationSeconds: dur,
            editLockedAt: new Date(ended.getTime() + TIMER_EDIT_WINDOW_HOURS * 3600 * 1000),
          },
        });
      }
      // Start a new session unless one already active for this task.
      const activeSelf = await tx.timerSession.findFirst({
        where: { userId: ctx.userId, taskId: task.id, endedAt: null },
      });
      if (!activeSelf) {
        await tx.timerSession.create({
          data: { userId: ctx.userId, taskId: task.id, startedAt: now },
        });
      }
    }

    if (toStatus === "BLOCKED" || toStatus === "DONE" || toStatus === "CANCELLED") {
      // Close any active session on this task (regardless of who started it).
      const active = await tx.timerSession.findFirst({
        where: { taskId: task.id, endedAt: null },
      });
      if (active) {
        const ended = now;
        const dur = Math.floor((ended.getTime() - active.startedAt.getTime()) / 1000);
        await tx.timerSession.update({
          where: { id: active.id },
          data: {
            endedAt: ended,
            durationSeconds: dur,
            editLockedAt: new Date(ended.getTime() + TIMER_EDIT_WINDOW_HOURS * 3600 * 1000),
          },
        });
      }
    }
  });
}
