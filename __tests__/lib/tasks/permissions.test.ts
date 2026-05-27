import { describe, it, expect } from "vitest";
import {
  canCreateTask,
  canEditTask,
  canDeleteTask,
  canCancelTask,
  canTransitionStatus,
  canReassignTask,
  canViewTask,
  canEditTimerSession,
  canViewMemberMetrics,
  canManageTeam,
  canManageTeamMembers,
  canViewTeamDashboard,
} from "@/lib/tasks/permissions";
import type { TenantContext, TaskRef, SessionRef } from "@/lib/tasks/types";

const ownerCtx: TenantContext = {
  userId: "owner1", orgId: "org1", orgRole: "OWNER",
  teamRoles: new Map(),
};
const adminCtx: TenantContext = {
  userId: "admin1", orgId: "org1", orgRole: "ADMIN",
  teamRoles: new Map(),
};
const managerCtx: TenantContext = {
  userId: "mgr1", orgId: "org1", orgRole: "MEMBER",
  teamRoles: new Map([["t1", "MANAGER"]]),
};
const memberCtx: TenantContext = {
  userId: "mem1", orgId: "org1", orgRole: "MEMBER",
  teamRoles: new Map([["t1", "MEMBER"]]),
};
const otherTeamMgr: TenantContext = {
  userId: "mgr2", orgId: "org1", orgRole: "MEMBER",
  teamRoles: new Map([["t2", "MANAGER"]]),
};
const viewerCtx: TenantContext = {
  userId: "viewer1", orgId: "org1", orgRole: "VIEWER",
  teamRoles: new Map(),
};

const baseTask: TaskRef = {
  id: "task1", organizationId: "org1", teamId: "t1",
  assigneeId: "mem1", status: "TODO",
};

describe("canCreateTask", () => {
  it("allows OWNER/ADMIN", () => {
    expect(canCreateTask(ownerCtx, "t1")).toBe(true);
    expect(canCreateTask(adminCtx, "t1")).toBe(true);
  });
  it("allows MANAGER of the team", () => {
    expect(canCreateTask(managerCtx, "t1")).toBe(true);
  });
  it("denies MANAGER of a different team", () => {
    expect(canCreateTask(otherTeamMgr, "t1")).toBe(false);
  });
  it("denies MEMBER", () => {
    expect(canCreateTask(memberCtx, "t1")).toBe(false);
  });
});

describe("canDeleteTask", () => {
  it("allows OWNER and ADMIN only", () => {
    expect(canDeleteTask(ownerCtx, baseTask)).toBe(true);
    expect(canDeleteTask(adminCtx, baseTask)).toBe(true);
    expect(canDeleteTask(managerCtx, baseTask)).toBe(false);
    expect(canDeleteTask(memberCtx, baseTask)).toBe(false);
  });
  it("denies VIEWER", () => {
    expect(canDeleteTask(viewerCtx, baseTask)).toBe(false);
  });
  it("denies cross-org access", () => {
    const crossOrg: TenantContext = {
      userId: "x", orgId: "org2", orgRole: "OWNER",
      teamRoles: new Map(),
    };
    expect(canDeleteTask(crossOrg, baseTask)).toBe(false);
  });
});

describe("canCancelTask", () => {
  it("allows OWNER, ADMIN, MANAGER of team", () => {
    expect(canCancelTask(ownerCtx, baseTask)).toBe(true);
    expect(canCancelTask(adminCtx, baseTask)).toBe(true);
    expect(canCancelTask(managerCtx, baseTask)).toBe(true);
    expect(canCancelTask(otherTeamMgr, baseTask)).toBe(false);
    expect(canCancelTask(memberCtx, baseTask)).toBe(false);
  });
});

describe("canTransitionStatus", () => {
  it("rejects invalid transitions even for admin", () => {
    expect(canTransitionStatus(ownerCtx, baseTask, "TODO", "DONE")).toBe(false);
    expect(canTransitionStatus(ownerCtx, { ...baseTask, status: "DONE" }, "DONE", "IN_PROGRESS")).toBe(false);
  });
  it("allows TODO → IN_PROGRESS for assignee", () => {
    expect(canTransitionStatus(memberCtx, baseTask, "TODO", "IN_PROGRESS")).toBe(true);
  });
  it("allows IN_PROGRESS → BLOCKED for assignee", () => {
    expect(canTransitionStatus(memberCtx, { ...baseTask, status: "IN_PROGRESS" }, "IN_PROGRESS", "BLOCKED")).toBe(true);
  });
  it("denies non-assignee non-manager from changing status", () => {
    const otherMember: TenantContext = {
      userId: "mem2", orgId: "org1", orgRole: "MEMBER",
      teamRoles: new Map([["t1", "MEMBER"]]),
    };
    expect(canTransitionStatus(otherMember, baseTask, "TODO", "IN_PROGRESS")).toBe(false);
  });
  it("allows MANAGER to force transition", () => {
    expect(canTransitionStatus(managerCtx, baseTask, "TODO", "IN_PROGRESS")).toBe(true);
  });
  it("allows → CANCELLED only via cancel privilege", () => {
    expect(canTransitionStatus(memberCtx, baseTask, "TODO", "CANCELLED")).toBe(false);
    expect(canTransitionStatus(managerCtx, baseTask, "TODO", "CANCELLED")).toBe(true);
  });
  it("denies cross-org access", () => {
    const crossOrg: TenantContext = {
      userId: "x", orgId: "org2", orgRole: "OWNER",
      teamRoles: new Map(),
    };
    expect(canTransitionStatus(crossOrg, baseTask, "TODO", "IN_PROGRESS")).toBe(false);
  });
});

describe("canReassignTask", () => {
  it("allows OWNER/ADMIN/MANAGER of team", () => {
    expect(canReassignTask(ownerCtx, baseTask)).toBe(true);
    expect(canReassignTask(managerCtx, baseTask)).toBe(true);
    expect(canReassignTask(memberCtx, baseTask)).toBe(false);
    expect(canReassignTask(otherTeamMgr, baseTask)).toBe(false);
  });
});

describe("canViewTask", () => {
  it("allows assignee", () => {
    expect(canViewTask(memberCtx, baseTask)).toBe(true);
  });
  it("allows manager of team", () => {
    expect(canViewTask(managerCtx, baseTask)).toBe(true);
  });
  it("allows admin/owner unconditionally (same org)", () => {
    expect(canViewTask(ownerCtx, baseTask)).toBe(true);
    expect(canViewTask(adminCtx, baseTask)).toBe(true);
  });
  it("denies non-assignee non-manager member", () => {
    const other: TenantContext = {
      userId: "mem2", orgId: "org1", orgRole: "MEMBER",
      teamRoles: new Map([["t1", "MEMBER"]]),
    };
    expect(canViewTask(other, baseTask)).toBe(false);
  });
  it("denies cross-org access", () => {
    const crossOrg: TenantContext = {
      userId: "x", orgId: "org2", orgRole: "OWNER",
      teamRoles: new Map(),
    };
    expect(canViewTask(crossOrg, baseTask)).toBe(false);
  });
});

describe("canEditTimerSession", () => {
  const session: SessionRef = {
    userId: "mem1",
    endedAt: new Date(Date.now() - 1000 * 60 * 60),
    editLockedAt: new Date(Date.now() + 1000 * 60 * 60 * 23),
  };
  it("allows assignee within 24h window", () => {
    expect(canEditTimerSession(memberCtx, session, baseTask)).toBe(true);
  });
  it("denies assignee after 24h window", () => {
    const expired = { ...session, editLockedAt: new Date(Date.now() - 1000) };
    expect(canEditTimerSession(memberCtx, expired, baseTask)).toBe(false);
  });
  it("allows manager of team regardless of window", () => {
    const expired = { ...session, editLockedAt: new Date(Date.now() - 1000) };
    expect(canEditTimerSession(managerCtx, expired, baseTask)).toBe(true);
  });
  it("denies manager of a different team", () => {
    const expired = { ...session, editLockedAt: new Date(Date.now() - 1000) };
    expect(canEditTimerSession(otherTeamMgr, expired, baseTask)).toBe(false);
  });
  it("allows owner/admin regardless of window", () => {
    const expired = { ...session, editLockedAt: new Date(Date.now() - 1000) };
    expect(canEditTimerSession(ownerCtx, expired, baseTask)).toBe(true);
    expect(canEditTimerSession(adminCtx, expired, baseTask)).toBe(true);
  });
  it("denies cross-org access", () => {
    const crossOrg: TenantContext = {
      userId: "x", orgId: "org2", orgRole: "OWNER",
      teamRoles: new Map(),
    };
    const expired = { ...session, editLockedAt: new Date(Date.now() - 1000) };
    expect(canEditTimerSession(crossOrg, expired, baseTask)).toBe(false);
  });
});

describe("canViewMemberMetrics", () => {
  it("allows self", () => {
    expect(canViewMemberMetrics(memberCtx, "mem1")).toBe(true);
  });
  it("allows manager for team member", () => {
    expect(canViewMemberMetrics(managerCtx, "mem1", { teamIds: ["t1"] })).toBe(true);
  });
  it("denies manager for non-team member", () => {
    expect(canViewMemberMetrics(managerCtx, "other", { teamIds: ["t2"] })).toBe(false);
  });
  it("allows admin/owner", () => {
    expect(canViewMemberMetrics(ownerCtx, "any-user-id")).toBe(true);
    expect(canViewMemberMetrics(adminCtx, "any-user-id")).toBe(true);
  });
});

describe("canManageTeam", () => {
  it("allows OWNER/ADMIN only", () => {
    expect(canManageTeam(ownerCtx)).toBe(true);
    expect(canManageTeam(adminCtx)).toBe(true);
    expect(canManageTeam(managerCtx)).toBe(false);
  });
  it("denies VIEWER", () => {
    expect(canManageTeam(viewerCtx)).toBe(false);
  });
});

describe("canManageTeamMembers", () => {
  it("allows OWNER/ADMIN", () => {
    expect(canManageTeamMembers(ownerCtx, "t1")).toBe(true);
    expect(canManageTeamMembers(adminCtx, "t1")).toBe(true);
  });
  it("allows MANAGER of that team", () => {
    expect(canManageTeamMembers(managerCtx, "t1")).toBe(true);
  });
  it("denies MANAGER of a different team", () => {
    expect(canManageTeamMembers(otherTeamMgr, "t1")).toBe(false);
  });
});

describe("canViewTeamDashboard", () => {
  it("allows OWNER and ADMIN", () => {
    expect(canViewTeamDashboard(ownerCtx, "t1")).toBe(true);
    expect(canViewTeamDashboard(adminCtx, "t1")).toBe(true);
  });
  it("allows MANAGER of that team", () => {
    expect(canViewTeamDashboard(managerCtx, "t1")).toBe(true);
  });
  it("denies MANAGER of a different team", () => {
    expect(canViewTeamDashboard(otherTeamMgr, "t1")).toBe(false);
  });
  it("denies plain MEMBER", () => {
    expect(canViewTeamDashboard(memberCtx, "t1")).toBe(false);
  });
});
