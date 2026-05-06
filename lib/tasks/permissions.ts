import type { TaskStatus } from "@prisma/client";
import type { TenantContext, TaskRef, SessionRef } from "@/lib/tasks/types";

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "DONE", "CANCELLED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

function isOwnerOrAdmin(ctx: TenantContext): boolean {
  return ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN";
}
function isManagerOfTeam(ctx: TenantContext, teamId: string): boolean {
  return ctx.teamRoles.get(teamId) === "MANAGER";
}
function sameOrg(ctx: TenantContext, task: TaskRef): boolean {
  return ctx.orgId === task.organizationId;
}

export function canCreateTask(ctx: TenantContext, teamId: string): boolean {
  return isOwnerOrAdmin(ctx) || isManagerOfTeam(ctx, teamId);
}

export function canEditTask(ctx: TenantContext, task: TaskRef): boolean {
  if (!sameOrg(ctx, task)) return false;
  return isOwnerOrAdmin(ctx) || isManagerOfTeam(ctx, task.teamId);
}

export function canDeleteTask(ctx: TenantContext, task: TaskRef): boolean {
  return sameOrg(ctx, task) && isOwnerOrAdmin(ctx);
}

export function canCancelTask(ctx: TenantContext, task: TaskRef): boolean {
  if (!sameOrg(ctx, task)) return false;
  return isOwnerOrAdmin(ctx) || isManagerOfTeam(ctx, task.teamId);
}

// Reassign follows edit rules: OWNER, ADMIN, or MANAGER of the task's team.
export function canReassignTask(ctx: TenantContext, task: TaskRef): boolean {
  return canEditTask(ctx, task);
}

export function canViewTask(ctx: TenantContext, task: TaskRef): boolean {
  if (!sameOrg(ctx, task)) return false;
  if (isOwnerOrAdmin(ctx)) return true;
  if (isManagerOfTeam(ctx, task.teamId)) return true;
  if (task.assigneeId === ctx.userId) return true;
  return false;
}

export function canTransitionStatus(
  ctx: TenantContext,
  task: TaskRef,
  fromStatus: TaskStatus,
  toStatus: TaskStatus
): boolean {
  if (fromStatus !== task.status) return false;
  if (!sameOrg(ctx, task)) return false;
  if (!ALLOWED_TRANSITIONS[fromStatus].includes(toStatus)) return false;

  if (toStatus === "CANCELLED") {
    return canCancelTask(ctx, task);
  }

  if (isOwnerOrAdmin(ctx)) return true;
  if (isManagerOfTeam(ctx, task.teamId)) return true;
  if (task.assigneeId === ctx.userId) return true;
  return false;
}

/**
 * Permission to edit a TimerSession. Single function consolidating prior
 * "asManager" variant. Order of checks:
 * - cross-org → false
 * - OWNER/ADMIN → true
 * - MANAGER of task's team → true (bypasses 24h window)
 * - session owner within 24h window → true
 * - otherwise → false
 */
export function canEditTimerSession(
  ctx: TenantContext,
  session: SessionRef,
  task: TaskRef
): boolean {
  if (!sameOrg(ctx, task)) return false;
  if (isOwnerOrAdmin(ctx)) return true;
  if (isManagerOfTeam(ctx, task.teamId)) return true;
  if (session.userId === ctx.userId) {
    if (!session.endedAt) return true; // session still in progress
    if (!session.editLockedAt) return true;
    return new Date() < session.editLockedAt;
  }
  return false;
}

export function canViewMemberMetrics(
  ctx: TenantContext,
  targetUserId: string,
  opts?: { teamIds?: string[] }
): boolean {
  if (ctx.userId === targetUserId) return true;
  if (isOwnerOrAdmin(ctx)) return true;
  if (opts?.teamIds && opts.teamIds.some((tid) => isManagerOfTeam(ctx, tid))) {
    return true;
  }
  return false;
}

export function canManageTeam(ctx: TenantContext): boolean {
  return isOwnerOrAdmin(ctx);
}

export function canManageTeamMembers(
  ctx: TenantContext,
  teamId: string
): boolean {
  return isOwnerOrAdmin(ctx) || isManagerOfTeam(ctx, teamId);
}

export function canViewTeamDashboard(
  ctx: TenantContext,
  teamId: string
): boolean {
  return isOwnerOrAdmin(ctx) || isManagerOfTeam(ctx, teamId);
}
