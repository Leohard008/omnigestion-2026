import { db } from "@/lib/db";
import type { TenantContext, TaskRef } from "@/lib/tasks/types";

export class TimerError extends Error {
  code: "FORBIDDEN" | "NOT_FOUND" | "EDIT_WINDOW_EXPIRED" | "INVALID";
  constructor(code: TimerError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

interface EditPayload {
  newStartedAt?: Date;
  newEndedAt?: Date;
  reason?: string;
}

export async function editTimerSession(
  ctx: TenantContext,
  sessionId: string,
  task: TaskRef,
  payload: EditPayload
): Promise<void> {
  await db.$transaction(async (tx) => {
    const session = await tx.timerSession.findFirst({
      where: { id: sessionId, taskId: task.id },
    });
    if (!session) throw new TimerError("NOT_FOUND", "Session introuvable");

    if (ctx.orgId !== task.organizationId) {
      throw new TimerError("FORBIDDEN", "Permission refusée");
    }

    const isManager = ctx.teamRoles.get(task.teamId) === "MANAGER";
    const isAdmin = ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN";
    const isOwnerOfSession = session.userId === ctx.userId;

    if (!isManager && !isAdmin && !isOwnerOfSession) {
      throw new TimerError("FORBIDDEN", "Permission refusée");
    }
    if (!isManager && !isAdmin && session.endedAt) {
      // Session has ended — 24h window applies to non-manager/admin assignees.
      if (session.editLockedAt && new Date() > session.editLockedAt) {
        throw new TimerError("EDIT_WINDOW_EXPIRED", "Fenêtre d'édition (24h window) dépassée");
      }
    }

    const newStarted = payload.newStartedAt ?? session.startedAt;
    const newEnded = payload.newEndedAt ?? session.endedAt;
    if (newEnded && newStarted >= newEnded) {
      throw new TimerError("INVALID", "endedAt doit être après startedAt");
    }
    const newDuration = newEnded
      ? Math.floor((newEnded.getTime() - newStarted.getTime()) / 1000)
      : null;

    await tx.timerSessionEdit.create({
      data: {
        sessionId,
        editedById: ctx.userId,
        oldStartedAt: session.startedAt,
        newStartedAt: newStarted,
        oldEndedAt: session.endedAt,
        newEndedAt: newEnded,
        oldDurationSec: session.durationSeconds,
        newDurationSec: newDuration,
        reason: payload.reason ?? null,
      },
    });

    await tx.timerSession.update({
      where: { id: sessionId },
      data: {
        startedAt: newStarted,
        endedAt: newEnded,
        durationSeconds: newDuration,
        isEdited: true,
      },
    });
  });
}

export async function getActiveTimerForUser(userId: string) {
  return db.timerSession.findFirst({
    where: { userId, endedAt: null },
    include: {
      task: { select: { id: true, title: true, teamId: true } },
    },
  });
}
