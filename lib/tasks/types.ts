import type { Role, TeamRole, TaskStatus } from "@prisma/client";

export type Period = "7d" | "30d" | "90d" | "12m";

export interface TenantContext {
  userId: string;
  orgId: string;
  orgRole: Role;
  teamRoles: Map<string, TeamRole>; // teamId → role in that team
}

/**
 * Shape of a task used by permission checks and transition logic.
 * Imported by lib/tasks/permissions.ts, lib/tasks/transitions.ts, lib/tasks/timer.ts.
 */
export interface TaskRef {
  id: string;
  organizationId: string;
  teamId: string;
  assigneeId: string;
  status: TaskStatus;
  startedAt?: Date | null;
  completedAt?: Date | null;
}

export interface MemberMetrics {
  userId: string;
  cycleTimeMedianSec: number | null;
  cycleTimeP75Sec: number | null;
  leadTimeMedianSec: number | null;
  leadTimeP75Sec: number | null;
  throughput: number;
  wipCount: number;
  flowEfficiencyAvg: number | null;
}

export interface TeamMetrics {
  teamId: string;
  period: Period;
  memberMetrics: MemberMetrics[];
  teamCycleTimeMedianSec: number | null;
  teamLeadTimeMedianSec: number | null;
  totalActive: number;
  totalDone: number;
  totalOverdue: number;
}

export interface AnomalyFlag {
  taskId: string;
  type: "INCONSISTENT_TIMER" | "EXCESSIVE_BLOCKED_RATIO";
  message: string;
}
