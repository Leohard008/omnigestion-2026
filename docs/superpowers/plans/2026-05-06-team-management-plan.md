# Team Management Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full team management module inside OmniGestion: tasks, status workflow, timer with audit, productivity metrics, anomaly detection, and 3 UI dashboards.

**Architecture:** New module under `app/dashboard/equipe/` with French URLs to match existing OmniGestion routes (`/api/equipe/...`). Append-only `TaskEvent` log as source of truth for timeline. Status changes auto-couple a single timer per user. Redis cache (5 min TTL) on aggregated metrics. RBAC scoped per team via `TeamMember.role` (no new org role).

**Tech Stack:** Next.js 15 (App Router) + TypeScript + Prisma + PostgreSQL + NextAuth v5 + ioredis + Tailwind + Shadcn UI + recharts + Vitest (new) + zod.

**Spec reference:** `docs/superpowers/specs/2026-05-06-team-management-design.md`

---

## Phase 1 — Foundation

### Task 1: Add Prisma models, enums, back-relations and run the migration

**Files:**
- Modify: `prisma/schema.prisma` (append new models, add back-relations to `Organization` and `User`)
- Run: `npx prisma migrate dev --name add_team_management`

- [ ] **Step 1: Add the 5 new enums at the end of the enums block in `prisma/schema.prisma`**

```prisma
enum TeamRole {
  MANAGER
  MEMBER
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  BLOCKED
  DONE
  CANCELLED
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TaskEventType {
  STATUS_CHANGE
  REASSIGNMENT
  FIELD_EDIT
}

enum NotificationType {
  TASK_ASSIGNED
  TASK_OVERDUE
  TASK_BLOCKED_LONG
  TASK_ANOMALY
}
```

- [ ] **Step 2: Add the 7 new models after the `Expense` model**

```prisma
// ============================================
// TEAM MANAGEMENT
// ============================================

model Team {
  id              String       @id @default(cuid())
  organizationId  String
  name            String
  description     String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  members         TeamMember[]
  tasks           Task[]

  @@unique([organizationId, name])
  @@index([organizationId])
  @@map("teams")
}

model TeamMember {
  id        String   @id @default(cuid())
  teamId    String
  userId    String
  role      TeamRole @default(MEMBER)
  joinedAt  DateTime @default(now())

  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@index([userId])
  @@map("team_members")
}

model Task {
  id              String       @id @default(cuid())
  organizationId  String
  teamId          String
  title           String
  description     String?
  assigneeId      String
  createdById     String
  dueDate         DateTime?
  priority        TaskPriority @default(MEDIUM)
  estimatedHours  Decimal?     @db.Decimal(6, 2)
  status          TaskStatus   @default(TODO)
  startedAt       DateTime?
  completedAt     DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  organization    Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  team            Team               @relation(fields: [teamId], references: [id], onDelete: Restrict)
  assignee        User               @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: Restrict)
  createdBy       User               @relation("TaskCreator", fields: [createdById], references: [id], onDelete: Restrict)
  events          TaskEvent[]
  sessions        TimerSession[]
  notifications   TaskNotification[]

  @@index([organizationId, status])
  @@index([teamId, status])
  @@index([assigneeId, status])
  @@index([dueDate])
  @@map("tasks")
}

model TaskEvent {
  id              String        @id @default(cuid())
  taskId          String
  eventType       TaskEventType
  fromStatus      TaskStatus?
  toStatus        TaskStatus?
  fromAssigneeId  String?
  toAssigneeId    String?
  fieldName       String?
  oldValue        String?
  newValue        String?
  byUserId        String
  at              DateTime      @default(now())
  reason          String?

  task            Task          @relation(fields: [taskId], references: [id], onDelete: Cascade)
  byUser          User          @relation(fields: [byUserId], references: [id])

  @@index([taskId, at])
  @@map("task_events")
}

model TimerSession {
  id              String    @id @default(cuid())
  taskId          String
  userId          String
  startedAt       DateTime
  endedAt         DateTime?
  durationSeconds Int?
  isEdited        Boolean   @default(false)
  editLockedAt    DateTime?
  createdAt       DateTime  @default(now())

  task            Task               @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user            User               @relation(fields: [userId], references: [id], onDelete: Restrict)
  edits           TimerSessionEdit[]

  @@index([userId, startedAt])
  @@index([taskId, startedAt])
  @@map("timer_sessions")
}

model TimerSessionEdit {
  id              String       @id @default(cuid())
  sessionId       String
  editedById      String
  oldStartedAt    DateTime
  newStartedAt    DateTime
  oldEndedAt      DateTime?
  newEndedAt      DateTime?
  oldDurationSec  Int?
  newDurationSec  Int?
  reason          String?
  editedAt        DateTime     @default(now())

  session         TimerSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  editedBy        User         @relation(fields: [editedById], references: [id])

  @@index([sessionId, editedAt])
  @@map("timer_session_edits")
}

model TaskNotification {
  id              String           @id @default(cuid())
  organizationId  String
  recipientId     String
  taskId          String
  type            NotificationType
  message         String
  readAt          DateTime?
  createdAt       DateTime         @default(now())

  organization    Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  recipient       User             @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  task            Task             @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([recipientId, readAt])
  @@index([organizationId])
  @@map("task_notifications")
}
```

- [ ] **Step 3: Add back-relations on `Organization`**

In the `Organization` model, add to the `// Relations` block:

```prisma
  teams              Team[]
  tasks              Task[]
  taskNotifications  TaskNotification[]
```

- [ ] **Step 4: Add back-relations on `User`**

In the `User` model, add to the `// Relations` block:

```prisma
  teamMemberships     TeamMember[]
  assignedTasks       Task[]              @relation("TaskAssignee")
  createdTasks        Task[]              @relation("TaskCreator")
  taskEvents          TaskEvent[]
  timerSessions       TimerSession[]
  timerSessionEdits   TimerSessionEdit[]
  taskNotifications   TaskNotification[]
```

- [ ] **Step 5: Generate Prisma client and run migration**

Run:
```bash
npx prisma migrate dev --name add_team_management
```
Expected: migration file created in `prisma/migrations/<timestamp>_add_team_management/migration.sql`, Prisma Client regenerated, no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(equipe): add Prisma schema for team management module"
```

---

### Task 2: Set up Vitest for unit tests

OmniGestion has no test runner. We add Vitest to TDD the lib layer.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `__tests__/setup.ts`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitest/ui happy-dom
```

- [ ] **Step 2: Create `vitest.config.ts` at project root**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 3: Create `__tests__/setup.ts`**

```ts
import { vi, afterEach } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 4: Add scripts in `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 5: Verify setup**

Run: `npm test`
Expected: "No test files found" — config valid, just no tests yet.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts __tests__/setup.ts
git commit -m "chore: add Vitest for unit tests"
```

---

### Task 3: Create shared types and constants

**Files:**
- Create: `lib/tasks/types.ts`
- Create: `lib/tasks/constants.ts`

- [ ] **Step 1: Create `lib/tasks/types.ts`**

```ts
import type { Role } from "@prisma/client";
import type { TeamRole, TaskStatus, TaskEventType } from "@prisma/client";

export type Period = "7d" | "30d" | "90d" | "12m";

export interface TenantContext {
  userId: string;
  orgId: string;
  orgRole: Role;
  teamRoles: Map<string, TeamRole>; // teamId → role in that team
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
```

- [ ] **Step 2: Create `lib/tasks/constants.ts`**

```ts
export const WIP_TARGET = 3;
export const WIP_ALERT_THRESHOLD = 5;
export const BLOCKED_LONG_HOURS = 48;
export const TIMER_EDIT_WINDOW_HOURS = 24;
export const METRICS_CACHE_TTL_SECONDS = 300;
export const COLLAB_VIEW_PERIOD_DAYS = 30;

export const PERIOD_TO_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "12m": 365,
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/tasks/types.ts lib/tasks/constants.ts
git commit -m "feat(equipe): add shared types and constants"
```

---

### Task 4: Create `getTenantContext()` helper

**Files:**
- Create: `lib/tenant.ts`
- Create: `__tests__/lib/tenant.test.ts`

- [ ] **Step 1: Write the failing test for `__tests__/lib/tenant.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tenant`
Expected: FAIL — module `@/lib/tenant` not found.

- [ ] **Step 3: Implement `lib/tenant.ts`**

```ts
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { TenantContext } from "@/lib/tasks/types";

export async function getTenantContext(): Promise<TenantContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const membership = await db.organizationMember.findFirst({
    where: { userId: session.user.id, isActive: true },
  });
  if (!membership) return null;

  const teamMemberships = await db.teamMember.findMany({
    where: {
      userId: session.user.id,
      team: { organizationId: membership.organizationId },
    },
    select: { teamId: true, role: true },
  });

  return {
    userId: session.user.id,
    orgId: membership.organizationId,
    orgRole: membership.role,
    teamRoles: new Map(teamMemberships.map((tm) => [tm.teamId, tm.role])),
  };
}

export async function requireTenantContext(): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx) throw new Error("UNAUTHENTICATED");
  return ctx;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tenant`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tenant.ts __tests__/lib/tenant.test.ts
git commit -m "feat(equipe): add getTenantContext helper with team roles"
```

---

## Phase 2 — RBAC & Permissions

### Task 5: Implement `lib/tasks/permissions.ts` with full TDD

The single source of truth for "who can do what". All API routes call these.

**Files:**
- Create: `lib/tasks/permissions.ts`
- Create: `__tests__/lib/tasks/permissions.test.ts`

- [ ] **Step 1: Write failing tests covering the RBAC matrix from the spec**

In `__tests__/lib/tasks/permissions.test.ts`:

```ts
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
} from "@/lib/tasks/permissions";
import type { TenantContext } from "@/lib/tasks/types";

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

const baseTask = {
  id: "task1", organizationId: "org1", teamId: "t1",
  assigneeId: "mem1", createdById: "mgr1",
  status: "TODO" as const,
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
  const session = {
    userId: "mem1", endedAt: new Date(Date.now() - 1000 * 60 * 60),
    editLockedAt: new Date(Date.now() + 1000 * 60 * 60 * 23),
  };
  it("allows assignee within 24h window", () => {
    expect(canEditTimerSession(memberCtx, session as any)).toBe(true);
  });
  it("denies assignee after 24h window", () => {
    const expired = { ...session, editLockedAt: new Date(Date.now() - 1000) };
    expect(canEditTimerSession(memberCtx, expired as any)).toBe(false);
  });
  it("allows manager regardless of window", () => {
    const expired = { ...session, editLockedAt: new Date(Date.now() - 1000) };
    expect(canEditTimerSession(managerCtx, expired as any)).toBe(true);
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- permissions`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/tasks/permissions.ts`**

```ts
import type { TaskStatus, TeamRole } from "@prisma/client";
import type { TenantContext } from "@/lib/tasks/types";

interface TaskRef {
  id: string;
  organizationId: string;
  teamId: string;
  assigneeId: string;
  status?: TaskStatus;
}

interface SessionRef {
  userId: string;
  endedAt: Date | null;
  editLockedAt: Date | null;
}

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
function isMemberOfTeam(ctx: TenantContext, teamId: string): boolean {
  return ctx.teamRoles.has(teamId);
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

export function canEditTimerSession(
  ctx: TenantContext,
  session: SessionRef
): boolean {
  if (isOwnerOrAdmin(ctx)) return true;
  // Manager privilege requires team check by caller (we don't have teamId here);
  // by convention, callers pass the task and check team via canEditTask first.
  // For sessions: if user is the session owner, apply 24h window.
  if (session.userId === ctx.userId) {
    if (!session.endedAt) return true; // session in progress
    if (!session.editLockedAt) return true;
    return new Date() < session.editLockedAt;
  }
  return false;
}

export function canEditTimerSessionAsManager(
  ctx: TenantContext,
  session: SessionRef,
  task: TaskRef
): boolean {
  if (!sameOrg(ctx, task)) return false;
  if (isOwnerOrAdmin(ctx)) return true;
  if (isManagerOfTeam(ctx, task.teamId)) return true;
  return canEditTimerSession(ctx, session);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- permissions`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/permissions.ts __tests__/lib/tasks/permissions.test.ts
git commit -m "feat(equipe): add RBAC permissions module with TDD coverage"
```

---

## Phase 3 — Teams CRUD (API + Admin UI)

### Task 6: API routes — Teams CRUD

**Files:**
- Create: `app/api/equipe/equipes/route.ts` (GET list, POST create)
- Create: `app/api/equipe/equipes/[id]/route.ts` (GET, PATCH, DELETE)

- [ ] **Step 1: Create `app/api/equipe/equipes/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeam } from "@/lib/tasks/permissions";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
});

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  // OWNER/ADMIN: all teams. Others: only their teams.
  const where =
    ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN"
      ? { organizationId: ctx.orgId }
      : { organizationId: ctx.orgId, members: { some: { userId: ctx.userId } } };

  const teams = await db.team.findMany({
    where,
    include: { _count: { select: { members: true, tasks: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(teams);
}

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canManageTeam(ctx)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  try {
    const team = await db.team.create({
      data: {
        organizationId: ctx.orgId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      },
    });
    return NextResponse.json(team, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Une équipe avec ce nom existe déjà" }, { status: 409 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Create `app/api/equipe/equipes/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeam } from "@/lib/tasks/permissions";

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(500).nullable().optional(),
});

async function loadTeam(orgId: string, teamId: string) {
  return db.team.findFirst({
    where: { id: teamId, organizationId: orgId },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const team = await loadTeam(ctx.orgId, id);
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json(team);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canManageTeam(ctx)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const updated = await db.team.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!canManageTeam(ctx)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const { id } = await params;
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Cascade: TeamMember + Tasks (Restrict → must cancel/delete tasks first).
  // For MVP, refuse delete if tasks exist.
  const tasksCount = await db.task.count({ where: { teamId: id } });
  if (tasksCount > 0) {
    return NextResponse.json(
      { error: "Supprimez ou réassignez les tâches avant de supprimer l'équipe" },
      { status: 409 }
    );
  }

  await db.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Manual smoke test**

Run dev server, log in as OWNER, POST /api/equipe/equipes with `{"name":"Test"}` → 201. Re-POST same name → 409. GET → list with the team.

- [ ] **Step 4: Commit**

```bash
git add app/api/equipe/equipes
git commit -m "feat(equipe): add teams CRUD API routes"
```

---

### Task 7: API routes — Team membership

**Files:**
- Create: `app/api/equipe/equipes/[id]/membres/route.ts` (POST add, GET list)
- Create: `app/api/equipe/equipes/[id]/membres/[userId]/route.ts` (PATCH role, DELETE remove)

- [ ] **Step 1: Create `app/api/equipe/equipes/[id]/membres/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeamMembers } from "@/lib/tasks/permissions";

const addSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["MANAGER", "MEMBER"]).default("MEMBER"),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const team = await db.team.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const members = await db.teamMember.findMany({
    where: { teamId: id },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return NextResponse.json(members);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  if (!canManageTeamMembers(ctx, id)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  // Only OWNER/ADMIN can designate MANAGER role.
  const body = await request.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  if (parsed.data.role === "MANAGER" && ctx.orgRole !== "OWNER" && ctx.orgRole !== "ADMIN") {
    return NextResponse.json(
      { error: "Seuls OWNER/ADMIN peuvent désigner un manager" },
      { status: 403 }
    );
  }

  // Verify user belongs to same org.
  const targetMembership = await db.organizationMember.findFirst({
    where: { userId: parsed.data.userId, organizationId: ctx.orgId, isActive: true },
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Utilisateur introuvable dans l'organisation" }, { status: 404 });
  }

  try {
    const tm = await db.teamMember.create({
      data: { teamId: id, userId: parsed.data.userId, role: parsed.data.role },
    });
    return NextResponse.json(tm, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Membre déjà dans l'équipe" }, { status: 409 });
    }
    throw e;
  }
}
```

- [ ] **Step 2: Create `app/api/equipe/equipes/[id]/membres/[userId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canManageTeamMembers } from "@/lib/tasks/permissions";

const patchSchema = z.object({
  role: z.enum(["MANAGER", "MEMBER"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id, userId } = await params;
  if (!canManageTeamMembers(ctx, id)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }
  // Only OWNER/ADMIN can modify role.
  if (ctx.orgRole !== "OWNER" && ctx.orgRole !== "ADMIN") {
    return NextResponse.json({ error: "Seuls OWNER/ADMIN peuvent changer le rôle" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const tm = await db.teamMember.findFirst({
    where: { teamId: id, userId, team: { organizationId: ctx.orgId } },
  });
  if (!tm) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const updated = await db.teamMember.update({
    where: { id: tm.id },
    data: { role: parsed.data.role },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id, userId } = await params;
  if (!canManageTeamMembers(ctx, id)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const tm = await db.teamMember.findFirst({
    where: { teamId: id, userId, team: { organizationId: ctx.orgId } },
  });
  if (!tm) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Refuse if user has active tasks assigned in this team.
  const activeTasks = await db.task.count({
    where: { teamId: id, assigneeId: userId, status: { in: ["TODO", "IN_PROGRESS", "BLOCKED"] } },
  });
  if (activeTasks > 0) {
    return NextResponse.json(
      { error: `Réassignez d'abord les ${activeTasks} tâche(s) actives de ce membre` },
      { status: 409 }
    );
  }

  await db.teamMember.delete({ where: { id: tm.id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/equipe/equipes/[id]/membres
git commit -m "feat(equipe): add team membership management API"
```

---

### Task 8: Admin UI — Teams page

**Files:**
- Create: `app/dashboard/equipe/equipes/page.tsx` (list + create)
- Create: `app/dashboard/equipe/equipes/[id]/page.tsx` (detail + members)
- Create: `components/equipe/TeamForm.tsx`
- Create: `components/equipe/TeamMembersList.tsx`

- [ ] **Step 1: Create `app/dashboard/equipe/equipes/page.tsx`** (Server Component, lists teams + form to create)

Structure (use existing OmniGestion patterns from `app/dashboard/clients/page.tsx`):
- Server-side: `requireTenantContext()` + `canManageTeam()` check, redirect to `/dashboard/equipe` if not allowed
- Fetch teams via `db.team.findMany`
- Render Card grid + `<TeamForm />` (client component, posts to `/api/equipe/equipes`)
- Each Card links to `/dashboard/equipe/equipes/[id]`

- [ ] **Step 2: Create `components/equipe/TeamForm.tsx`** (Client component)

Use `react-hook-form` + `zod` (already in stack). Two fields: name (required), description (optional). On success: `router.refresh()`.

- [ ] **Step 3: Create `app/dashboard/equipe/equipes/[id]/page.tsx`** (Server Component)

- Fetch team + members
- If user not OWNER/ADMIN/MANAGER of the team → redirect
- Render: edit form (name/desc), member list with role toggle (only OWNER/ADMIN sees toggle), invite member dropdown (lists OrganizationMembers not yet in team), remove button per member

- [ ] **Step 4: Create `components/equipe/TeamMembersList.tsx`** (Client component)

Props: `{ teamId: string; members: MemberWithUser[]; canChangeRoles: boolean; }`. Per row: avatar, name, role badge, role select (if `canChangeRoles`), remove button. Confirm dialog on remove.

- [ ] **Step 5: Manual test**

Log in as OWNER, navigate to `/dashboard/equipe/equipes`, create team, add member, change role, remove member.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/equipe/equipes components/equipe/TeamForm.tsx components/equipe/TeamMembersList.tsx
git commit -m "feat(equipe): add admin UI for team management"
```

---

## Phase 4 — Tasks API & State Machine

### Task 9: Implement `lib/tasks/transitions.ts` with TDD

The atomic transition function: validates RBAC + transition, creates `TaskEvent`, updates `Task` materialized fields, manages timer side-effects.

**Files:**
- Create: `lib/tasks/transitions.ts`
- Create: `__tests__/lib/tasks/transitions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
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
      teamRoles: new Map([["team1", "MEMBER"]]),
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
    tx.timerSession.findFirst.mockResolvedValue({
      id: "sess-other", taskId: "tOther", userId: "u1", startedAt: new Date(Date.now() - 1000 * 60 * 30),
    });

    const ctx = {
      userId: "u1", orgId: "org1", orgRole: "MEMBER" as const,
      teamRoles: new Map([["team1", "MEMBER"]]),
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
      teamRoles: new Map([["team1", "MEMBER"]]),
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
      teamRoles: new Map([["team1", "MEMBER"]]),
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
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- transitions
```

- [ ] **Step 3: Implement `lib/tasks/transitions.ts`**

```ts
import { db } from "@/lib/db";
import type { Task, TaskStatus, Prisma } from "@prisma/client";
import type { TenantContext } from "@/lib/tasks/types";
import { canTransitionStatus } from "@/lib/tasks/permissions";
import { TIMER_EDIT_WINDOW_HOURS } from "@/lib/tasks/constants";

export class TransitionError extends Error {
  code: "FORBIDDEN" | "INVALID_TRANSITION" | "NOT_FOUND";
  constructor(code: "FORBIDDEN" | "INVALID_TRANSITION" | "NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

interface TaskRef extends Pick<Task, "id" | "organizationId" | "teamId" | "assigneeId" | "status" | "startedAt" | "completedAt"> {}

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
      // Close any active session on this task (regardless of who started it — typically the assignee).
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test -- transitions
```

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/transitions.ts __tests__/lib/tasks/transitions.test.ts
git commit -m "feat(equipe): add status transition engine with timer auto-coupling"
```

---

### Task 10: API — Tasks CRUD

**Files:**
- Create: `app/api/equipe/taches/route.ts` (GET list, POST create)
- Create: `app/api/equipe/taches/[id]/route.ts` (GET, PATCH, DELETE)

- [ ] **Step 1: Create `app/api/equipe/taches/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canCreateTask } from "@/lib/tasks/permissions";

const createSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().min(1),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  estimatedHours: z.number().positive().max(9999).optional(),
});

export async function GET(request: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "mine"; // "mine" | "team" | "all"
  const status = url.searchParams.get("status");
  const teamId = url.searchParams.get("teamId");

  const where: any = { organizationId: ctx.orgId };
  if (status) where.status = status;
  if (teamId) where.teamId = teamId;

  if (scope === "mine") {
    where.assigneeId = ctx.userId;
  } else if (scope === "team") {
    // Tasks in teams where ctx is manager or member.
    const myTeams = Array.from(ctx.teamRoles.keys());
    where.teamId = { in: myTeams };
  } else if (scope === "all") {
    if (ctx.orgRole !== "OWNER" && ctx.orgRole !== "ADMIN") {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }
  }

  const tasks = await db.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      team: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const data = parsed.data;

  if (!canCreateTask(ctx, data.teamId)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  // Verify team belongs to org and assignee is in that team.
  const team = await db.team.findFirst({
    where: { id: data.teamId, organizationId: ctx.orgId },
    include: { members: { where: { userId: data.assigneeId } } },
  });
  if (!team) return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
  if (team.members.length === 0) {
    return NextResponse.json({ error: "L'assigné doit être membre de l'équipe" }, { status: 400 });
  }

  const task = await db.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        organizationId: ctx.orgId,
        teamId: data.teamId,
        title: data.title,
        description: data.description ?? null,
        assigneeId: data.assigneeId,
        createdById: ctx.userId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority,
        estimatedHours: data.estimatedHours ?? null,
      },
    });
    await tx.taskEvent.create({
      data: {
        taskId: t.id,
        eventType: "STATUS_CHANGE",
        fromStatus: null,
        toStatus: "TODO",
        byUserId: ctx.userId,
      },
    });
    // TASK_ASSIGNED notification
    if (data.assigneeId !== ctx.userId) {
      await tx.taskNotification.create({
        data: {
          organizationId: ctx.orgId,
          recipientId: data.assigneeId,
          taskId: t.id,
          type: "TASK_ASSIGNED",
          message: `Nouvelle tâche assignée : ${data.title}`,
        },
      });
    }
    return t;
  });

  return NextResponse.json(task, { status: 201 });
}
```

- [ ] **Step 2: Create `app/api/equipe/taches/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canViewTask, canEditTask, canDeleteTask } from "@/lib/tasks/permissions";

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  estimatedHours: z.number().positive().max(9999).nullable().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      createdBy: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      events: {
        include: { byUser: { select: { id: true, name: true } } },
        orderBy: { at: "asc" },
      },
      sessions: {
        include: { edits: { include: { editedBy: { select: { id: true, name: true } } }, orderBy: { editedAt: "asc" } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canViewTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  return NextResponse.json(task);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canEditTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  const updates: Record<string, any> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }
  if (updates.dueDate) updates.dueDate = new Date(updates.dueDate);

  // Build FIELD_EDIT events for each changed field.
  await db.$transaction(async (tx) => {
    for (const [k, v] of Object.entries(updates)) {
      const oldVal = (task as any)[k];
      const oldStr = oldVal == null ? null : String(oldVal instanceof Date ? oldVal.toISOString() : oldVal);
      const newStr = v == null ? null : String(v instanceof Date ? v.toISOString() : v);
      if (oldStr === newStr) continue;
      await tx.taskEvent.create({
        data: {
          taskId: id,
          eventType: "FIELD_EDIT",
          fieldName: k,
          oldValue: oldStr,
          newValue: newStr,
          byUserId: ctx.userId,
        },
      });
    }
    await tx.task.update({ where: { id }, data: updates });
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canDeleteTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });
  await db.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/equipe/taches
git commit -m "feat(equipe): add tasks CRUD API with FIELD_EDIT audit events"
```

---

### Task 11: API — Status change & Reassignment

**Files:**
- Create: `app/api/equipe/taches/[id]/status/route.ts`
- Create: `app/api/equipe/taches/[id]/assign/route.ts`

- [ ] **Step 1: Create `app/api/equipe/taches/[id]/status/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { transitionStatus, TransitionError } from "@/lib/tasks/transitions";
import { redis } from "@/lib/redis";

const schema = z.object({
  toStatus: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  try {
    await transitionStatus(ctx, task, parsed.data.toStatus, parsed.data.reason);
  } catch (e) {
    if (e instanceof TransitionError) {
      const status = e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status });
    }
    throw e;
  }

  await redis.del(`metrics:org:${ctx.orgId}:team:${task.teamId}`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create `app/api/equipe/taches/[id]/assign/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canReassignTask } from "@/lib/tasks/permissions";
import { redis } from "@/lib/redis";

const schema = z.object({
  toAssigneeId: z.string().min(1),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;

  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canReassignTask(ctx, task)) return NextResponse.json({ error: "Interdit" }, { status: 403 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const newAssigneeId = parsed.data.toAssigneeId;
  if (newAssigneeId === task.assigneeId) {
    return NextResponse.json({ error: "Déjà assigné à cet utilisateur" }, { status: 400 });
  }

  // Verify new assignee is in the same team (cf. RBAC E).
  const tm = await db.teamMember.findFirst({
    where: { teamId: task.teamId, userId: newAssigneeId },
  });
  if (!tm) {
    return NextResponse.json({ error: "Le nouvel assigné doit être membre de l'équipe" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.taskEvent.create({
      data: {
        taskId: task.id,
        eventType: "REASSIGNMENT",
        fromAssigneeId: task.assigneeId,
        toAssigneeId: newAssigneeId,
        byUserId: ctx.userId,
      },
    });
    await tx.task.update({ where: { id: task.id }, data: { assigneeId: newAssigneeId } });
    await tx.taskNotification.create({
      data: {
        organizationId: ctx.orgId,
        recipientId: newAssigneeId,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        message: `Une tâche vous a été réassignée : ${task.title}`,
      },
    });
  });

  await redis.del(`metrics:org:${ctx.orgId}:team:${task.teamId}`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/equipe/taches/[id]/status app/api/equipe/taches/[id]/assign
git commit -m "feat(equipe): add status change and reassignment API endpoints"
```

---

## Phase 5 — Timer & Audit

### Task 12: `lib/tasks/timer.ts` with TDD — explicit start/stop & session edit

The status-coupled timer logic is in `transitions.ts`. This file handles **explicit** timer actions (start/stop without status change) and the **edit** flow with audit log.

**Files:**
- Create: `lib/tasks/timer.ts`
- Create: `__tests__/lib/tasks/timer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
      teamRoles: new Map([["team1", "MEMBER"]]),
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
      teamRoles: new Map([["team1", "MEMBER"]]),
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
      teamRoles: new Map([["team1", "MANAGER"]]),
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
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- timer
```

- [ ] **Step 3: Implement `lib/tasks/timer.ts`**

```ts
import { db } from "@/lib/db";
import type { TenantContext } from "@/lib/tasks/types";
import { canEditTimerSessionAsManager } from "@/lib/tasks/permissions";
import type { Task, TimerSession } from "@prisma/client";

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
  task: Pick<Task, "id" | "organizationId" | "teamId" | "assigneeId" | "status">,
  payload: EditPayload
): Promise<void> {
  await db.$transaction(async (tx) => {
    const session = await tx.timerSession.findFirst({
      where: { id: sessionId, taskId: task.id },
    });
    if (!session) throw new TimerError("NOT_FOUND", "Session introuvable");

    const isManager = ctx.teamRoles.get(task.teamId) === "MANAGER";
    const isAdmin = ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN";
    const isOwnerOfSession = session.userId === ctx.userId;

    if (!isManager && !isAdmin && !isOwnerOfSession) {
      throw new TimerError("FORBIDDEN", "Permission refusée");
    }
    if (!isManager && !isAdmin && session.editLockedAt && new Date() > session.editLockedAt) {
      throw new TimerError("EDIT_WINDOW_EXPIRED", "Fenêtre d'édition de 24h dépassée");
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
npm test -- timer
```

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/timer.ts __tests__/lib/tasks/timer.test.ts
git commit -m "feat(equipe): add timer edit logic with audit log"
```

---

### Task 13: API — Timer endpoints

**Files:**
- Create: `app/api/equipe/taches/[id]/timer/start/route.ts`
- Create: `app/api/equipe/taches/[id]/timer/stop/route.ts`
- Create: `app/api/equipe/taches/[id]/timer/sessions/[sessionId]/route.ts`
- Create: `app/api/equipe/timer/active/route.ts` (GET active timer for current user — used by widget)

- [ ] **Step 1: Create `app/api/equipe/taches/[id]/timer/start/route.ts`**

This endpoint is **a shortcut** for "TODO/BLOCKED → IN_PROGRESS" (delegates to `transitionStatus`).

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { transitionStatus, TransitionError } from "@/lib/tasks/transitions";
import { redis } from "@/lib/redis";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (task.status === "IN_PROGRESS") return NextResponse.json({ ok: true, alreadyActive: true });

  try {
    await transitionStatus(ctx, task, "IN_PROGRESS");
  } catch (e) {
    if (e instanceof TransitionError) {
      const code = e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status: code });
    }
    throw e;
  }

  await redis.del(`metrics:org:${ctx.orgId}:team:${task.teamId}`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create `app/api/equipe/taches/[id]/timer/stop/route.ts`** — shortcut for "→ BLOCKED" or "→ DONE"

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { transitionStatus, TransitionError } from "@/lib/tasks/transitions";
import { redis } from "@/lib/redis";

const schema = z.object({
  outcome: z.enum(["BLOCKED", "DONE"]),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  try {
    await transitionStatus(ctx, task, parsed.data.outcome, parsed.data.reason);
  } catch (e) {
    if (e instanceof TransitionError) {
      const code = e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: e.message }, { status: code });
    }
    throw e;
  }

  await redis.del(`metrics:org:${ctx.orgId}:team:${task.teamId}`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create `app/api/equipe/taches/[id]/timer/sessions/[sessionId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { editTimerSession, TimerError } from "@/lib/tasks/timer";
import { redis } from "@/lib/redis";

const schema = z.object({
  newStartedAt: z.string().datetime().optional(),
  newEndedAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id, sessionId } = await params;
  const task = await db.task.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!task) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

  try {
    await editTimerSession(ctx, sessionId, task, {
      newStartedAt: parsed.data.newStartedAt ? new Date(parsed.data.newStartedAt) : undefined,
      newEndedAt: parsed.data.newEndedAt ? new Date(parsed.data.newEndedAt) : undefined,
      reason: parsed.data.reason,
    });
  } catch (e) {
    if (e instanceof TimerError) {
      const code = e.code === "FORBIDDEN" ? 403 : e.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: e.message }, { status: code });
    }
    throw e;
  }

  await redis.del(`metrics:org:${ctx.orgId}:team:${task.teamId}`);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `app/api/equipe/timer/active/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { getActiveTimerForUser } from "@/lib/tasks/timer";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const active = await getActiveTimerForUser(ctx.userId);
  return NextResponse.json(active);
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/equipe/taches/[id]/timer app/api/equipe/timer
git commit -m "feat(equipe): add timer start/stop/edit and active endpoints"
```

---

## Phase 6 — Metrics & Redis Cache

### Task 14: `lib/tasks/metrics.ts` — formulas

**Files:**
- Create: `lib/tasks/metrics.ts`
- Create: `__tests__/lib/tasks/metrics.test.ts`

- [ ] **Step 1: Write the failing test for the pure helper functions**

```ts
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
```

- [ ] **Step 2: Run test — FAIL**

```bash
npm test -- metrics
```

- [ ] **Step 3: Implement `lib/tasks/metrics.ts`**

```ts
import { db } from "@/lib/db";
import type { Period, MemberMetrics, TeamMetrics, AnomalyFlag } from "@/lib/tasks/types";
import { PERIOD_TO_DAYS, WIP_ALERT_THRESHOLD } from "@/lib/tasks/constants";

export function computeP50(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  if (sorted.length % 2 === 1) return sorted[Math.floor(mid)];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeP75(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * 0.75;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (hi - idx) + sorted[hi] * (idx - lo);
}

export function periodToDate(period: Period, now = new Date()): Date {
  const days = PERIOD_TO_DAYS[period] ?? 30;
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export async function computeTeamMetrics(
  orgId: string,
  teamId: string,
  period: Period
): Promise<TeamMetrics> {
  const since = periodToDate(period);

  // Fetch tasks DONE in period (for cycle time + throughput).
  const doneTasks = await db.task.findMany({
    where: {
      organizationId: orgId,
      teamId,
      status: "DONE",
      completedAt: { gte: since },
    },
    select: {
      id: true,
      assigneeId: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  // Tasks ever started in period (for lead time).
  const startedTasks = await db.task.findMany({
    where: {
      organizationId: orgId,
      teamId,
      startedAt: { gte: since, not: null },
      status: { not: "CANCELLED" },
    },
    select: { assigneeId: true, createdAt: true, startedAt: true },
  });

  // Active tasks for WIP per member.
  const activeTasks = await db.task.findMany({
    where: {
      organizationId: orgId,
      teamId,
      status: { in: ["IN_PROGRESS", "BLOCKED"] },
    },
    select: { assigneeId: true },
  });

  // Sessions for done tasks (for flow efficiency).
  const sessionsByTask = await db.timerSession.groupBy({
    by: ["taskId"],
    where: {
      taskId: { in: doneTasks.map((t) => t.id) },
      endedAt: { not: null },
    },
    _sum: { durationSeconds: true },
  });
  const sessionSumByTask = new Map(sessionsByTask.map((r) => [r.taskId, r._sum.durationSeconds ?? 0]));

  // Group by assignee.
  const byAssignee = new Map<string, MemberMetrics>();
  function ensure(uid: string): MemberMetrics {
    if (!byAssignee.has(uid)) {
      byAssignee.set(uid, {
        userId: uid,
        cycleTimeMedianSec: null, cycleTimeP75Sec: null,
        leadTimeMedianSec: null, leadTimeP75Sec: null,
        throughput: 0, wipCount: 0, flowEfficiencyAvg: null,
      });
    }
    return byAssignee.get(uid)!;
  }

  const cycleByUser: Record<string, number[]> = {};
  const leadByUser: Record<string, number[]> = {};
  const flowByUser: Record<string, number[]> = {};

  for (const t of doneTasks) {
    if (!t.startedAt || !t.completedAt) continue;
    const cycle = (t.completedAt.getTime() - t.startedAt.getTime()) / 1000;
    (cycleByUser[t.assigneeId] ??= []).push(cycle);
    ensure(t.assigneeId).throughput += 1;

    const sessionSum = sessionSumByTask.get(t.id) ?? 0;
    if (cycle > 0) {
      const flow = Math.min(1, sessionSum / cycle);
      (flowByUser[t.assigneeId] ??= []).push(flow);
    }
  }

  for (const t of startedTasks) {
    if (!t.startedAt) continue;
    const lead = (t.startedAt.getTime() - t.createdAt.getTime()) / 1000;
    (leadByUser[t.assigneeId] ??= []).push(lead);
  }

  for (const t of activeTasks) {
    ensure(t.assigneeId).wipCount += 1;
  }

  for (const [uid, arr] of Object.entries(cycleByUser)) {
    const m = ensure(uid);
    m.cycleTimeMedianSec = computeP50(arr);
    m.cycleTimeP75Sec = computeP75(arr);
  }
  for (const [uid, arr] of Object.entries(leadByUser)) {
    const m = ensure(uid);
    m.leadTimeMedianSec = computeP50(arr);
    m.leadTimeP75Sec = computeP75(arr);
  }
  for (const [uid, arr] of Object.entries(flowByUser)) {
    const m = ensure(uid);
    m.flowEfficiencyAvg = arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  // Team aggregates.
  const allCycle: number[] = Object.values(cycleByUser).flat();
  const allLead: number[] = Object.values(leadByUser).flat();
  const overdue = await db.task.count({
    where: {
      organizationId: orgId, teamId,
      dueDate: { lt: new Date() },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
  });

  return {
    teamId,
    period,
    memberMetrics: Array.from(byAssignee.values()),
    teamCycleTimeMedianSec: computeP50(allCycle),
    teamLeadTimeMedianSec: computeP50(allLead),
    totalActive: activeTasks.length,
    totalDone: doneTasks.length,
    totalOverdue: overdue,
  };
}

export async function detectAnomalies(orgId: string, teamId: string): Promise<AnomalyFlag[]> {
  const flags: AnomalyFlag[] = [];

  // INCONSISTENT_TIMER on DONE tasks of last 7 days
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const doneTasks = await db.task.findMany({
    where: {
      organizationId: orgId, teamId, status: "DONE",
      completedAt: { gte: since },
      startedAt: { not: null },
    },
    select: { id: true, startedAt: true, completedAt: true, title: true },
  });
  if (doneTasks.length > 0) {
    const sums = await db.timerSession.groupBy({
      by: ["taskId"],
      where: { taskId: { in: doneTasks.map((t) => t.id) }, endedAt: { not: null } },
      _sum: { durationSeconds: true },
    });
    const map = new Map(sums.map((r) => [r.taskId, r._sum.durationSeconds ?? 0]));
    for (const t of doneTasks) {
      if (!t.startedAt || !t.completedAt) continue;
      const cycleSec = (t.completedAt.getTime() - t.startedAt.getTime()) / 1000;
      const sum = map.get(t.id) ?? 0;
      if (cycleSec > 8 * 3600 && sum < 2 * 3600) {
        flags.push({
          taskId: t.id,
          type: "INCONSISTENT_TIMER",
          message: `Tâche "${t.title}" — temps actif (${Math.round(sum / 3600)}h) très inférieur au cycle (${Math.round(cycleSec / 3600)}h). Session non clôturée ?`,
        });
      }
    }
  }

  return flags;
}
```

- [ ] **Step 4: Run test — PASS**

```bash
npm test -- metrics
```

- [ ] **Step 5: Commit**

```bash
git add lib/tasks/metrics.ts __tests__/lib/tasks/metrics.test.ts
git commit -m "feat(equipe): add metrics computation (P50/P75, cycle/lead/throughput/flow)"
```

---

### Task 15: `lib/tasks/cache.ts` + Metrics API

**Files:**
- Create: `lib/tasks/cache.ts`
- Create: `app/api/equipe/metrics/team/[teamId]/route.ts`
- Create: `app/api/equipe/metrics/member/[userId]/route.ts`

- [ ] **Step 1: Create `lib/tasks/cache.ts`**

```ts
import { redis } from "@/lib/redis";
import { METRICS_CACHE_TTL_SECONDS } from "@/lib/tasks/constants";

export function teamMetricsKey(orgId: string, teamId: string, period: string) {
  return `metrics:org:${orgId}:team:${teamId}:${period}`;
}

export async function getCachedMetrics<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCachedMetrics(key: string, data: unknown): Promise<void> {
  await redis.setex(key, METRICS_CACHE_TTL_SECONDS, JSON.stringify(data));
}

export async function invalidateTeamMetrics(orgId: string, teamId: string): Promise<void> {
  // Delete all period variants.
  for (const p of ["7d", "30d", "90d", "12m"]) {
    await redis.del(teamMetricsKey(orgId, teamId, p));
  }
}
```

- [ ] **Step 2: Create `app/api/equipe/metrics/team/[teamId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getTenantContext } from "@/lib/tenant";
import { canViewTeamDashboard } from "@/lib/tasks/permissions";
import { computeTeamMetrics, detectAnomalies } from "@/lib/tasks/metrics";
import { teamMetricsKey, getCachedMetrics, setCachedMetrics } from "@/lib/tasks/cache";
import type { Period } from "@/lib/tasks/types";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { teamId } = await params;

  const team = await db.team.findFirst({ where: { id: teamId, organizationId: ctx.orgId } });
  if (!team) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (!canViewTeamDashboard(ctx, teamId)) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const url = new URL(request.url);
  const period = (url.searchParams.get("period") ?? "30d") as Period;
  if (!["7d", "30d", "90d", "12m"].includes(period)) {
    return NextResponse.json({ error: "Période invalide" }, { status: 400 });
  }

  const key = teamMetricsKey(ctx.orgId, teamId, period);
  const cached = await getCachedMetrics(key);
  if (cached) return NextResponse.json({ ...cached, cached: true });

  const metrics = await computeTeamMetrics(ctx.orgId, teamId, period);
  const anomalies = await detectAnomalies(ctx.orgId, teamId);
  const payload = { ...metrics, anomalies };
  await setCachedMetrics(key, payload);
  return NextResponse.json(payload);
}
```

- [ ] **Step 3: Create `app/api/equipe/metrics/member/[userId]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canViewMemberMetrics } from "@/lib/tasks/permissions";
import { computeP50, computeP75, periodToDate } from "@/lib/tasks/metrics";
import { COLLAB_VIEW_PERIOD_DAYS } from "@/lib/tasks/constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { userId } = await params;

  // Discover teams the target user belongs to (within the same org).
  const memberTeams = await db.teamMember.findMany({
    where: { userId, team: { organizationId: ctx.orgId } },
    select: { teamId: true },
  });
  const teamIds = memberTeams.map((m) => m.teamId);

  if (!canViewMemberMetrics(ctx, userId, { teamIds })) {
    return NextResponse.json({ error: "Interdit" }, { status: 403 });
  }

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") ?? COLLAB_VIEW_PERIOD_DAYS);
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const done = await db.task.findMany({
    where: { organizationId: ctx.orgId, assigneeId: userId, status: "DONE", completedAt: { gte: since } },
    select: { startedAt: true, completedAt: true },
  });
  const started = await db.task.findMany({
    where: { organizationId: ctx.orgId, assigneeId: userId, startedAt: { gte: since, not: null }, status: { not: "CANCELLED" } },
    select: { createdAt: true, startedAt: true },
  });
  const wip = await db.task.count({
    where: { organizationId: ctx.orgId, assigneeId: userId, status: { in: ["IN_PROGRESS", "BLOCKED"] } },
  });

  const cycle = done.filter((t) => t.startedAt && t.completedAt).map((t) => (t.completedAt!.getTime() - t.startedAt!.getTime()) / 1000);
  const lead = started.filter((t) => t.startedAt).map((t) => (t.startedAt!.getTime() - t.createdAt.getTime()) / 1000);

  // Trend by week (last 4 weeks)
  const trend: { weekStart: string; cycleMedianSec: number | null; throughput: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(Date.now() - (w + 1) * 7 * 24 * 3600 * 1000);
    const weekEnd = new Date(Date.now() - w * 7 * 24 * 3600 * 1000);
    const tasksThisWeek = done.filter(
      (t) => t.completedAt && t.completedAt >= weekStart && t.completedAt < weekEnd
    );
    const arr = tasksThisWeek.filter((t) => t.startedAt && t.completedAt).map((t) => (t.completedAt!.getTime() - t.startedAt!.getTime()) / 1000);
    trend.push({
      weekStart: weekStart.toISOString(),
      cycleMedianSec: computeP50(arr),
      throughput: tasksThisWeek.length,
    });
  }

  return NextResponse.json({
    userId,
    days,
    cycleTimeMedianSec: computeP50(cycle),
    cycleTimeP75Sec: computeP75(cycle),
    leadTimeMedianSec: computeP50(lead),
    leadTimeP75Sec: computeP75(lead),
    throughput: done.length,
    wipCount: wip,
    trend,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/tasks/cache.ts app/api/equipe/metrics
git commit -m "feat(equipe): add Redis-cached metrics API for team and member"
```

---

## Phase 7 — Notifications & Cron

### Task 16: Notification API

**Files:**
- Create: `app/api/equipe/notifications/route.ts`
- Create: `app/api/equipe/notifications/[id]/read/route.ts`

- [ ] **Step 1: Create `app/api/equipe/notifications/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";

export async function GET(request: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const url = new URL(request.url);
  const onlyUnread = url.searchParams.get("unread") === "1";

  const where: any = { organizationId: ctx.orgId, recipientId: ctx.userId };
  if (onlyUnread) where.readAt = null;

  const [notifications, unreadCount] = await Promise.all([
    db.taskNotification.findMany({
      where,
      include: { task: { select: { id: true, title: true, teamId: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.taskNotification.count({
      where: { organizationId: ctx.orgId, recipientId: ctx.userId, readAt: null },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
```

- [ ] **Step 2: Create `app/api/equipe/notifications/[id]/read/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const result = await db.taskNotification.updateMany({
    where: { id, organizationId: ctx.orgId, recipientId: ctx.userId },
    data: { readAt: new Date() },
  });
  if (result.count === 0) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/equipe/notifications
git commit -m "feat(equipe): add in-app notifications API"
```

---

### Task 17: Cron — anomaly detection & overdue/blocked notifications

**Files:**
- Create: `lib/tasks/anomaly-job.ts` (logic)
- Create: `app/api/cron/equipe-anomalies/route.ts` (Vercel Cron entry)
- Create: `vercel.json` (or modify existing) — cron schedule

- [ ] **Step 1: Create `lib/tasks/anomaly-job.ts`**

```ts
import { db } from "@/lib/db";
import { BLOCKED_LONG_HOURS, WIP_ALERT_THRESHOLD } from "@/lib/tasks/constants";

interface NotifyInsert {
  organizationId: string;
  recipientId: string;
  taskId: string;
  type: "TASK_OVERDUE" | "TASK_BLOCKED_LONG" | "TASK_ANOMALY";
  message: string;
}

async function getManagersOfTeam(teamId: string): Promise<string[]> {
  const rows = await db.teamMember.findMany({
    where: { teamId, role: "MANAGER" },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

async function getOrgAdmins(orgId: string): Promise<string[]> {
  const rows = await db.organizationMember.findMany({
    where: { organizationId: orgId, isActive: true, role: { in: ["OWNER", "ADMIN"] } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

async function notifyIfNotRecent(
  notif: NotifyInsert,
  windowHours = 24
): Promise<void> {
  const since = new Date(Date.now() - windowHours * 3600 * 1000);
  const existing = await db.taskNotification.findFirst({
    where: {
      organizationId: notif.organizationId,
      recipientId: notif.recipientId,
      taskId: notif.taskId,
      type: notif.type,
      createdAt: { gte: since },
    },
  });
  if (!existing) {
    await db.taskNotification.create({ data: notif });
  }
}

export async function runAnomalyJob(): Promise<{ processed: number }> {
  let processed = 0;

  // 1. TASK_OVERDUE — assignee + managers + admins of org
  const overdue = await db.task.findMany({
    where: {
      dueDate: { lt: new Date() },
      status: { notIn: ["DONE", "CANCELLED"] },
    },
    select: { id: true, organizationId: true, teamId: true, assigneeId: true, title: true },
  });
  for (const t of overdue) {
    const recipients = new Set<string>([t.assigneeId]);
    (await getManagersOfTeam(t.teamId)).forEach((u) => recipients.add(u));
    (await getOrgAdmins(t.organizationId)).forEach((u) => recipients.add(u));
    for (const r of recipients) {
      await notifyIfNotRecent({
        organizationId: t.organizationId,
        recipientId: r,
        taskId: t.id,
        type: "TASK_OVERDUE",
        message: `Tâche en retard : ${t.title}`,
      });
      processed += 1;
    }
  }

  // 2. TASK_BLOCKED_LONG — last STATUS_CHANGE → BLOCKED older than 48h
  const blockedTasks = await db.task.findMany({
    where: { status: "BLOCKED" },
    select: { id: true, organizationId: true, teamId: true, assigneeId: true, title: true },
  });
  for (const t of blockedTasks) {
    const lastBlocked = await db.taskEvent.findFirst({
      where: { taskId: t.id, eventType: "STATUS_CHANGE", toStatus: "BLOCKED" },
      orderBy: { at: "desc" },
    });
    if (!lastBlocked) continue;
    const hoursSince = (Date.now() - lastBlocked.at.getTime()) / 3600 / 1000;
    if (hoursSince < BLOCKED_LONG_HOURS) continue;

    const recipients = new Set<string>([t.assigneeId]);
    (await getManagersOfTeam(t.teamId)).forEach((u) => recipients.add(u));
    for (const r of recipients) {
      await notifyIfNotRecent({
        organizationId: t.organizationId,
        recipientId: r,
        taskId: t.id,
        type: "TASK_BLOCKED_LONG",
        message: `Tâche bloquée depuis plus de 48h : ${t.title}`,
      });
      processed += 1;
    }
  }

  // 3. WIP_EXCESS — group active tasks by assignee per team
  const groups = await db.task.groupBy({
    by: ["organizationId", "teamId", "assigneeId"],
    where: { status: { in: ["IN_PROGRESS", "BLOCKED"] } },
    _count: { _all: true },
  });
  for (const g of groups) {
    if ((g._count?._all ?? 0) <= WIP_ALERT_THRESHOLD) continue;
    const managers = await getManagersOfTeam(g.teamId);
    // Pick most recent task to anchor the notification
    const anyTask = await db.task.findFirst({
      where: { organizationId: g.organizationId, teamId: g.teamId, assigneeId: g.assigneeId, status: { in: ["IN_PROGRESS", "BLOCKED"] } },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (!anyTask) continue;
    for (const m of managers) {
      await notifyIfNotRecent({
        organizationId: g.organizationId,
        recipientId: m,
        taskId: anyTask.id,
        type: "TASK_ANOMALY",
        message: `Un membre a ${g._count?._all} tâches actives (alerte > ${WIP_ALERT_THRESHOLD}).`,
      });
      processed += 1;
    }
  }

  return { processed };
}
```

- [ ] **Step 2: Create `app/api/cron/equipe-anomalies/route.ts`**

```ts
import { NextResponse } from "next/server";
import { runAnomalyJob } from "@/lib/tasks/anomaly-job";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const result = await runAnomalyJob();
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Add Vercel Cron config**

Create or modify `vercel.json` at project root:

```json
{
  "crons": [
    { "path": "/api/cron/equipe-anomalies", "schedule": "0 * * * *" }
  ]
}
```

Add `CRON_SECRET` to `.env.local` and Vercel env settings.

- [ ] **Step 4: Commit**

```bash
git add lib/tasks/anomaly-job.ts app/api/cron/equipe-anomalies vercel.json
git commit -m "feat(equipe): add hourly cron for overdue/blocked/WIP notifications"
```

---

## Phase 8 — UI Components

### Task 18: Sidebar entry & icons

**Files:**
- Modify: `components/dashboard/sidebar-nav.tsx` (add "Équipe" entry)

- [ ] **Step 1: Find the existing sidebar items array and add a new entry**

Add after the existing entries:

```tsx
{ href: "/dashboard/equipe", label: "Équipe", icon: Users }
```

Use `Users` icon from `lucide-react` (already in stack).

- [ ] **Step 2: Verify rendering manually**

Run dev server, log in, confirm the entry appears and routes to `/dashboard/equipe`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/sidebar-nav.tsx
git commit -m "feat(equipe): add sidebar entry for team management"
```

---

### Task 19: `<TaskCard />` component

**Files:**
- Create: `components/equipe/TaskCard.tsx`

- [ ] **Step 1: Create `components/equipe/TaskCard.tsx`** (Server-safe — no client hooks)

```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertCircle, CheckCircle, Pause, Play } from "lucide-react";
import type { TaskStatus, TaskPriority } from "@prisma/client";

const PRIORITY_VARIANT: Record<TaskPriority, string> = {
  LOW: "secondary",
  MEDIUM: "default",
  HIGH: "destructive",
  URGENT: "destructive",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  BLOCKED: "Bloquée",
  DONE: "Terminée",
  CANCELLED: "Annulée",
};

const STATUS_ICON: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  TODO: Clock,
  IN_PROGRESS: Play,
  BLOCKED: Pause,
  DONE: CheckCircle,
  CANCELLED: AlertCircle,
};

interface Props {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | string | null;
    estimatedHours: number | null;
    team?: { id: string; name: string };
    assignee?: { id: string; name: string | null };
  };
  showAssignee?: boolean;
}

export function TaskCard({ task, showAssignee }: Props) {
  const StatusIcon = STATUS_ICON[task.status];
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date() && task.status !== "DONE" && task.status !== "CANCELLED";

  return (
    <Link
      href={`/dashboard/equipe/taches/${task.id}`}
      className="block rounded-lg border bg-white p-4 hover:border-slate-300 transition"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm flex-1 truncate">{task.title}</h3>
        <Badge variant={PRIORITY_VARIANT[task.priority] as any}>{task.priority}</Badge>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          {STATUS_LABEL[task.status]}
        </span>
        {task.team && <span>· {task.team.name}</span>}
        {showAssignee && task.assignee && <span>· {task.assignee.name ?? "—"}</span>}
        {due && (
          <span className={isOverdue ? "text-red-600 font-medium" : ""}>
            · Échéance {due.toLocaleDateString("fr-FR")}
          </span>
        )}
        {task.estimatedHours && <span>· Est. {Number(task.estimatedHours)}h</span>}
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/equipe/TaskCard.tsx
git commit -m "feat(equipe): add TaskCard component"
```

---

### Task 20: `<TimerWidget />` floating component

**Files:**
- Create: `components/equipe/TimerWidget.tsx` (Client component)
- Modify: `app/dashboard/layout.tsx` (mount widget)

- [ ] **Step 1: Create `components/equipe/TimerWidget.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pause, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActiveTimer {
  id: string;
  startedAt: string;
  taskId: string;
  task: { id: string; title: string };
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

export function TimerWidget() {
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const r = await fetch("/api/equipe/timer/active");
      if (!cancelled && r.ok) {
        const data: ActiveTimer | null = await r.json();
        setActive(data);
        if (data) setElapsed(Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000));
      }
    }
    load();
    const poll = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(tick);
  }, [active]);

  if (!active) return null;

  async function action(outcome: "BLOCKED" | "DONE") {
    if (!active) return;
    let reason: string | undefined;
    if (outcome === "BLOCKED") {
      reason = window.prompt("Raison du blocage (optionnel) :") ?? undefined;
    }
    const r = await fetch(`/api/equipe/taches/${active.taskId}/timer/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, reason }),
    });
    if (r.ok) {
      setActive(null);
      router.refresh();
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-white shadow-lg p-3 w-72">
      <Link href={`/dashboard/equipe/taches/${active.taskId}`} className="block text-sm font-medium truncate hover:underline">
        ▶ {active.task.title}
      </Link>
      <div className="mt-1 text-xs text-slate-500">⏱ {formatElapsed(elapsed)}</div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => action("BLOCKED")}>
          <Pause className="h-3 w-3 mr-1" /> Bloquer
        </Button>
        <Button size="sm" onClick={() => action("DONE")}>
          <CheckCircle className="h-3 w-3 mr-1" /> Terminer
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Modify `app/dashboard/layout.tsx`**

Add `<TimerWidget />` import and render it just before the closing `</div>` of the main wrapper:

```tsx
import { TimerWidget } from "@/components/equipe/TimerWidget";
// …
<TimerWidget />
```

- [ ] **Step 3: Commit**

```bash
git add components/equipe/TimerWidget.tsx app/dashboard/layout.tsx
git commit -m "feat(equipe): add floating TimerWidget mounted in dashboard layout"
```

---

### Task 21: `<TaskTimeline />` component

**Files:**
- Create: `components/equipe/TaskTimeline.tsx`

- [ ] **Step 1: Create `components/equipe/TaskTimeline.tsx`** (Server-safe)

Render a vertical timeline merging `TaskEvent[]`, `TimerSession[]`, and per-session `TimerSessionEdit[]` in chronological order.

```tsx
import type { TaskEvent, TimerSession, TimerSessionEdit, TaskStatus } from "@prisma/client";

interface Props {
  events: (TaskEvent & { byUser: { id: string; name: string | null } })[];
  sessions: (TimerSession & {
    edits: (TimerSessionEdit & { editedBy: { id: string; name: string | null } })[];
  })[];
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  BLOCKED: "Bloquée",
  DONE: "Terminée",
  CANCELLED: "Annulée",
};

function fmt(d: Date | string) {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}
function durHM(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export function TaskTimeline({ events, sessions }: Props) {
  type Item = { at: Date; render: () => React.ReactNode };
  const items: Item[] = [];

  for (const e of events) {
    items.push({
      at: new Date(e.at),
      render: () => {
        if (e.eventType === "STATUS_CHANGE") {
          return (
            <div>
              {fmt(e.at)} — {e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : "Création — "}
              <strong>{e.toStatus ? STATUS_LABEL[e.toStatus] : ""}</strong> par {e.byUser.name ?? "—"}
              {e.reason && <em className="ml-2 text-slate-500">({e.reason})</em>}
            </div>
          );
        }
        if (e.eventType === "REASSIGNMENT") {
          return (
            <div>
              🔄 {fmt(e.at)} — Réassignée par {e.byUser.name ?? "—"}
            </div>
          );
        }
        return (
          <div>
            ✏ {fmt(e.at)} — Champ <code>{e.fieldName}</code> modifié par {e.byUser.name ?? "—"}{" "}
            <span className="text-slate-500">({e.oldValue ?? "∅"} → {e.newValue ?? "∅"})</span>
          </div>
        );
      },
    });
  }

  for (const s of sessions) {
    items.push({
      at: new Date(s.startedAt),
      render: () => (
        <div className="ml-4 text-slate-600">
          ⏱ Session {fmt(s.startedAt)} → {s.endedAt ? fmt(s.endedAt) : "en cours"}
          {s.durationSeconds && <span> ({durHM(s.durationSeconds)})</span>}
          {s.isEdited && <span className="ml-2 text-blue-600">✏ éditée</span>}
          {s.edits.length > 0 && (
            <ul className="ml-6 mt-1 text-xs">
              {s.edits.map((ed) => (
                <li key={ed.id}>
                  ↳ Modifiée par {ed.editedBy.name ?? "—"} le {fmt(ed.editedAt)}
                  {ed.oldDurationSec != null && ed.newDurationSec != null && (
                    <> — {durHM(ed.oldDurationSec)} → {durHM(ed.newDurationSec)}</>
                  )}
                  {ed.reason && <em className="ml-1">({ed.reason})</em>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  }

  items.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <ol className="space-y-1 text-sm">
      {items.map((it, i) => (
        <li key={i}>{it.render()}</li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/equipe/TaskTimeline.tsx
git commit -m "feat(equipe): add TaskTimeline component"
```

---

### Task 22: `<HeatmapMatrix />` and `<MetricsBoard />`

**Files:**
- Create: `components/equipe/HeatmapMatrix.tsx`
- Create: `components/equipe/MetricsBoard.tsx`

- [ ] **Step 1: Create `components/equipe/HeatmapMatrix.tsx`** (Server-safe)

2x2 grid. Axes: `leadTimeP50` (vs team median) × `cycleTimeP50` (vs team median). Members positioned in the 4 quadrants with neutral labels.

```tsx
interface Member {
  userId: string;
  name: string | null;
  cycleTimeMedianSec: number | null;
  leadTimeMedianSec: number | null;
}

interface Props {
  members: Member[];
  teamCycleMedian: number | null;
  teamLeadMedian: number | null;
}

const QUADRANT_LABEL = {
  TL: "À débloquer",
  TR: "Surchargé ?",
  BL: "Inégal",
  BR: "Top performer",
} as const;

export function HeatmapMatrix({ members, teamCycleMedian, teamLeadMedian }: Props) {
  if (!teamCycleMedian || !teamLeadMedian) {
    return <p className="text-sm text-slate-500">Pas assez de données pour la heatmap.</p>;
  }
  const buckets = { TL: [] as Member[], TR: [] as Member[], BL: [] as Member[], BR: [] as Member[] };
  for (const m of members) {
    if (m.cycleTimeMedianSec == null || m.leadTimeMedianSec == null) continue;
    const slowExec = m.cycleTimeMedianSec > teamCycleMedian;
    const slowStart = m.leadTimeMedianSec > teamLeadMedian;
    const k = slowExec ? (slowStart ? "TL" : "TR") : slowStart ? "BL" : "BR";
    buckets[k].push(m);
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {(["TL", "TR", "BL", "BR"] as const).map((k) => (
        <div key={k} className="rounded border bg-slate-50 p-3">
          <div className="text-xs font-medium text-slate-700">{QUADRANT_LABEL[k]}</div>
          <ul className="mt-1 text-sm">
            {buckets[k].map((m) => (
              <li key={m.userId} className="truncate">
                {m.name ?? m.userId}
              </li>
            ))}
            {buckets[k].length === 0 && <li className="text-slate-400 italic">—</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `components/equipe/MetricsBoard.tsx`** (Client — uses recharts)

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface MemberRow {
  userId: string;
  name: string | null;
  wipCount: number;
  throughput: number;
  cycleTimeMedianSec: number | null;
  leadTimeMedianSec: number | null;
  flowEfficiencyAvg: number | null;
}

interface Props {
  members: MemberRow[];
}

function fmtH(seconds: number | null) {
  if (seconds == null) return "—";
  const h = seconds / 3600;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(seconds / 60)} min`;
}

export function MetricsBoard({ members }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="px-3 py-2 text-left">Membre</th>
            <th className="px-3 py-2 text-right">WIP</th>
            <th className="px-3 py-2 text-right">Throughput</th>
            <th className="px-3 py-2 text-right">Cycle P50</th>
            <th className="px-3 py-2 text-right">Lead P50</th>
            <th className="px-3 py-2 text-right">Flow</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr key={m.userId} className="border-t">
              <td className="px-3 py-2">{m.name ?? m.userId}</td>
              <td className="px-3 py-2 text-right">{m.wipCount}</td>
              <td className="px-3 py-2 text-right">{m.throughput}</td>
              <td className="px-3 py-2 text-right">{fmtH(m.cycleTimeMedianSec)}</td>
              <td className="px-3 py-2 text-right">{fmtH(m.leadTimeMedianSec)}</td>
              <td className="px-3 py-2 text-right">
                {m.flowEfficiencyAvg == null ? "—" : `${Math.round(m.flowEfficiencyAvg * 100)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/equipe/HeatmapMatrix.tsx components/equipe/MetricsBoard.tsx
git commit -m "feat(equipe): add HeatmapMatrix and MetricsBoard components"
```

---

## Phase 9 — UI Pages

### Task 23: Vue collaborateur — `/dashboard/equipe`

**Files:**
- Create: `app/dashboard/equipe/page.tsx` (Server Component)
- Create: `components/equipe/CollabMetrics.tsx` (Client — fetches /api/equipe/metrics/member/me)
- Create: `components/equipe/TaskFilters.tsx` (Client — query string filters)
- Create: `components/equipe/NewTaskButton.tsx` (Client — modal form)

- [ ] **Step 1: Create `app/dashboard/equipe/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TaskCard } from "@/components/equipe/TaskCard";
import { CollabMetrics } from "@/components/equipe/CollabMetrics";
import { TaskFilters } from "@/components/equipe/TaskFilters";
import { NewTaskButton } from "@/components/equipe/NewTaskButton";

export default async function EquipePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/auth/login");

  const sp = await searchParams;
  const status = sp.status;
  const where: any = { organizationId: ctx.orgId, assigneeId: ctx.userId };
  if (status) where.status = status;

  const tasks = await db.task.findMany({
    where,
    include: { team: { select: { id: true, name: true } } },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  const canCreate =
    ctx.orgRole === "OWNER" ||
    ctx.orgRole === "ADMIN" ||
    Array.from(ctx.teamRoles.values()).includes("MANAGER");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mes tâches</h1>
        {canCreate && <NewTaskButton />}
      </header>
      <CollabMetrics />
      <TaskFilters current={status} />
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune tâche.</p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={t} />)
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/equipe/CollabMetrics.tsx`** (Client)

Fetch `/api/equipe/metrics/member/<currentUserId>?days=30`. Show three cards (lead median, cycle median, throughput) and a small recharts line chart for `trend`. Get current userId via a separate `/api/equipe/me` route OR pass it as a prop from the server page.

For simplicity, accept the userId as a prop:

```tsx
"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface Metrics {
  leadTimeMedianSec: number | null;
  cycleTimeMedianSec: number | null;
  throughput: number;
  trend: { weekStart: string; cycleMedianSec: number | null; throughput: number }[];
}

function fmtH(s: number | null) {
  if (s == null) return "—";
  return `${(s / 3600).toFixed(1)}h`;
}

export function CollabMetrics({ userId }: { userId: string }) {
  const [data, setData] = useState<Metrics | null>(null);
  useEffect(() => {
    fetch(`/api/equipe/metrics/member/${userId}?days=30`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [userId]);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="rounded border p-3">
        <div className="text-xs text-slate-500">Temps avant démarrage médian</div>
        <div className="text-xl font-semibold">{fmtH(data.leadTimeMedianSec)}</div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-slate-500">Temps d'exécution médian</div>
        <div className="text-xl font-semibold">{fmtH(data.cycleTimeMedianSec)}</div>
      </div>
      <div className="rounded border p-3">
        <div className="text-xs text-slate-500">Tâches terminées (30j)</div>
        <div className="text-xl font-semibold">{data.throughput}</div>
      </div>
      <div className="rounded border p-3 col-span-1 md:col-span-1">
        <div className="text-xs text-slate-500">Tendance 4 semaines</div>
        <div className="h-12">
          <ResponsiveContainer>
            <LineChart data={data.trend}>
              <Line type="monotone" dataKey="throughput" dot={false} stroke="#0ea5e9" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

Update the server page to pass `userId={ctx.userId}` to `<CollabMetrics />`.

- [ ] **Step 3: Create `components/equipe/TaskFilters.tsx`** (Client)

Five buttons (Tous + 4 statuts non-CANCELLED). Active button highlighted. On click: `router.push("?status=...")`.

- [ ] **Step 4: Create `components/equipe/NewTaskButton.tsx`** (Client)

Dialog with form (title, description, teamId via select, assigneeId via select filtered by team, priority, dueDate, estimatedHours). POSTs to `/api/equipe/taches`. On success: `router.refresh()`.

- [ ] **Step 5: Manual smoke test**

Log in as MEMBER, visit `/dashboard/equipe`, verify metrics + tasks list. Log in as MANAGER, verify "+ Nouvelle tâche" button appears.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/equipe/page.tsx components/equipe/CollabMetrics.tsx components/equipe/TaskFilters.tsx components/equipe/NewTaskButton.tsx
git commit -m "feat(equipe): add collaborator dashboard page with metrics and filters"
```

---

### Task 24: Vue manager — `/dashboard/equipe/manager`

**Files:**
- Create: `app/dashboard/equipe/manager/page.tsx`
- Create: `components/equipe/ManagerDashboard.tsx` (Client — period selector + team selector + composes board+heatmap+anomalies)

- [ ] **Step 1: Create `app/dashboard/equipe/manager/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { ManagerDashboard } from "@/components/equipe/ManagerDashboard";

export default async function ManagerPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/auth/login");

  const isAdmin = ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN";
  const managerTeamIds = Array.from(ctx.teamRoles.entries())
    .filter(([, r]) => r === "MANAGER")
    .map(([t]) => t);

  if (!isAdmin && managerTeamIds.length === 0) redirect("/dashboard/equipe");

  const visibleTeams = await db.team.findMany({
    where: isAdmin
      ? { organizationId: ctx.orgId }
      : { id: { in: managerTeamIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Tableau d'équipe</h1>
      <ManagerDashboard teams={visibleTeams} isAdmin={isAdmin} />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/equipe/ManagerDashboard.tsx`** (Client)

Holds:
- Period radio (`7d` / `30d` / `90d` / `12m`)
- Team select (or "Toutes les équipes" for admin)
- Fetches `/api/equipe/metrics/team/<teamId>?period=<period>` (or aggregates per team if "all")
- Renders synthesis card, anomalies list, `<MetricsBoard />`, `<HeatmapMatrix />`, trend chart

Skeleton:

```tsx
"use client";
import { useEffect, useState } from "react";
import { MetricsBoard } from "./MetricsBoard";
import { HeatmapMatrix } from "./HeatmapMatrix";
import type { Period } from "@/lib/tasks/types";

interface Team { id: string; name: string }
interface Props { teams: Team[]; isAdmin: boolean }

export function ManagerDashboard({ teams, isAdmin }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [teamId, setTeamId] = useState<string>(teams[0]?.id ?? "");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!teamId) return;
    fetch(`/api/equipe/metrics/team/${teamId}?period=${period}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, [teamId, period]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="border rounded px-2 py-1 text-sm">
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex gap-1">
          {(["7d", "30d", "90d", "12m"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-xs px-2 py-1 rounded ${period === p ? "bg-slate-900 text-white" : "bg-slate-100"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Membres</div>
              <div className="text-xl font-semibold">{data.memberMetrics.length}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Tâches actives</div>
              <div className="text-xl font-semibold">{data.totalActive}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">Tâches terminées ({period})</div>
              <div className="text-xl font-semibold">{data.totalDone}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-slate-500">En retard</div>
              <div className={`text-xl font-semibold ${data.totalOverdue > 0 ? "text-amber-600" : ""}`}>
                {data.totalOverdue}
              </div>
            </div>
          </div>

          {data.anomalies?.length > 0 && (
            <div className="rounded border bg-blue-50 p-3">
              <div className="text-sm font-medium mb-2">Anomalies ({data.anomalies.length})</div>
              <ul className="space-y-1 text-sm">
                {data.anomalies.map((a: any) => (
                  <li key={a.taskId}>🔵 {a.message}</li>
                ))}
              </ul>
            </div>
          )}

          <MetricsBoard members={data.memberMetrics} />
          <HeatmapMatrix
            members={data.memberMetrics}
            teamCycleMedian={data.teamCycleTimeMedianSec}
            teamLeadMedian={data.teamLeadTimeMedianSec}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/equipe/manager/page.tsx components/equipe/ManagerDashboard.tsx
git commit -m "feat(equipe): add manager dashboard page"
```

---

### Task 25: Vue détail tâche — `/dashboard/equipe/taches/[id]`

**Files:**
- Create: `app/dashboard/equipe/taches/[id]/page.tsx`
- Create: `components/equipe/TaskActions.tsx` (Client — buttons that POST to status endpoints)
- Create: `components/equipe/SessionsEditor.tsx` (Client — table of sessions with edit dialog)

- [ ] **Step 1: Create `app/dashboard/equipe/taches/[id]/page.tsx`**

Server component. Fetch the task with all relations (already supported by GET /api/equipe/taches/[id] but here we hit DB directly):

```tsx
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { canViewTask, canEditTask, canDeleteTask } from "@/lib/tasks/permissions";
import { TaskTimeline } from "@/components/equipe/TaskTimeline";
import { TaskActions } from "@/components/equipe/TaskActions";
import { SessionsEditor } from "@/components/equipe/SessionsEditor";
import { Badge } from "@/components/ui/badge";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/auth/login");
  const { id } = await params;

  const task = await db.task.findFirst({
    where: { id, organizationId: ctx.orgId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } },
      events: { include: { byUser: { select: { id: true, name: true } } }, orderBy: { at: "asc" } },
      sessions: {
        include: { edits: { include: { editedBy: { select: { id: true, name: true } } }, orderBy: { editedAt: "asc" } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });
  if (!task) notFound();
  if (!canViewTask(ctx, task)) redirect("/dashboard/equipe");

  const totalSec = task.sessions
    .filter((s) => s.endedAt)
    .reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0);
  const editableForUser = canEditTask(ctx, task);
  const deletableForUser = canDeleteTask(ctx, task);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{task.title}</h1>
        <div className="flex items-center gap-2">
          <Badge>{task.priority}</Badge>
          <Badge variant="outline">{task.status}</Badge>
        </div>
      </div>
      <p className="text-sm text-slate-500">
        Équipe : {task.team.name} · Assigné : {task.assignee.name ?? "—"} · Créée par : {task.createdBy.name ?? "—"}
      </p>
      {task.description && <p className="whitespace-pre-line">{task.description}</p>}

      <TaskActions task={task} ctxUserId={ctx.userId} canEdit={editableForUser} canDelete={deletableForUser} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded border p-3">
          <div className="text-xs text-slate-500">Temps total tracké</div>
          <div className="text-xl font-semibold">{(totalSec / 3600).toFixed(1)}h</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-slate-500">Sessions</div>
          <div className="text-xl font-semibold">{task.sessions.length}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs text-slate-500">vs estimation</div>
          <div className="text-xl font-semibold">
            {task.estimatedHours ? `${(totalSec / 3600).toFixed(1)} / ${Number(task.estimatedHours)}h` : "—"}
          </div>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-medium mb-2">Timeline</h2>
        <TaskTimeline events={task.events as any} sessions={task.sessions as any} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Sessions</h2>
        <SessionsEditor taskId={task.id} sessions={task.sessions as any} />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create `components/equipe/TaskActions.tsx`** (Client)

Buttons to start/block/done/cancel + reassign dropdown. Each button calls the corresponding API and `router.refresh()` on success. Show only buttons appropriate to current status + permissions.

- [ ] **Step 3: Create `components/equipe/SessionsEditor.tsx`** (Client)

Table: per row, inputs for `startedAt`, `endedAt` (datetime-local), reason. Disabled if `editLockedAt < now()` AND user is the session owner. "Sauvegarder" button PATCHes `/api/equipe/taches/{id}/timer/sessions/{sessionId}`. Show audit history collapsed beside.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/equipe/taches components/equipe/TaskActions.tsx components/equipe/SessionsEditor.tsx
git commit -m "feat(equipe): add task detail page with actions, timeline, sessions editor"
```

---

### Task 26: Page "Comment ça marche" — `/dashboard/equipe/comment-ca-marche`

**Files:**
- Create: `app/dashboard/equipe/comment-ca-marche/page.tsx` (Server — static markdown rendered via Tailwind prose)

- [ ] **Step 1: Create the page** with sections: "Quelles données sont collectées", "Qui voit quoi", "Combien de temps les données sont conservées" (durée illimitée tant que le compte existe — V2 RGPD à raffiner), "Comment éditer une session", "Comment fonctionnent les anomalies".

Use plain JSX with Tailwind `prose` class.

- [ ] **Step 2: Add a footer link "ℹ Comment fonctionne ce module"** in the layout file `app/dashboard/equipe/page.tsx` (and the manager + detail pages) pointing to this page.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/equipe/comment-ca-marche
git commit -m "feat(equipe): add transparency page documenting data and visibility rules"
```

---

## Phase 10 — Polish & E2E

### Task 27: Notifications bell in topbar

**Files:**
- Modify: `components/dashboard/topbar.tsx` (add bell + dropdown)
- Create: `components/equipe/NotificationsBell.tsx`

- [ ] **Step 1: Create `components/equipe/NotificationsBell.tsx`** (Client)

Polls `/api/equipe/notifications?unread=1` every 60s. Shows bell icon with badge if `unreadCount > 0`. On click: dropdown lists notifications, click marks as read via POST `/api/equipe/notifications/[id]/read` and navigates to `/dashboard/equipe/taches/{taskId}`.

- [ ] **Step 2: Mount in topbar**

Add `<NotificationsBell />` next to the user avatar in `components/dashboard/topbar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/equipe/NotificationsBell.tsx components/dashboard/topbar.tsx
git commit -m "feat(equipe): add notifications bell in dashboard topbar"
```

---

### Task 28: Manual smoke test checklist

No automated E2E setup in OmniGestion currently. Run through this scenario once on dev server before declaring the module complete.

- [ ] **Login as OWNER and create a team "Test"**
- [ ] **Add 2 members from the org (non-OWNER) into that team**
- [ ] **Designate one as MANAGER**
- [ ] **As MANAGER, create a task assigned to the MEMBER**
- [ ] **Verify MEMBER receives in-app notification "TASK_ASSIGNED"**
- [ ] **As MEMBER, click ▶ Démarrer on the task → verify status IN_PROGRESS, timer widget appears bottom-right**
- [ ] **Wait 30 seconds, refresh page → timer widget shows correct elapsed time**
- [ ] **Click ⏸ Bloquer with reason "test" → status BLOCKED, timer widget disappears**
- [ ] **Click ▶ Démarrer again → reopens timer**
- [ ] **Click ✓ Terminer → status DONE, timer closed**
- [ ] **Visit `/dashboard/equipe/taches/[id]` → timeline shows: Création, IN_PROGRESS, BLOCKED ("test"), IN_PROGRESS, DONE + 2 timer sessions**
- [ ] **Edit session 1 (within 24h) — change duration, set reason "smoke" → verify audit log row appears under the session**
- [ ] **As MANAGER, visit `/dashboard/equipe/manager` → verify member appears in MetricsBoard with throughput=1**
- [ ] **As MANAGER, manually create 6 tasks for a single member, no progress → verify after cron run (or manual trigger) that WIP_EXCESS notification fires**
- [ ] **Manually trigger cron**: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/equipe-anomalies`
- [ ] **As MEMBER not in the team, attempt to GET /api/equipe/taches/[id] → 403**

- [ ] **Commit smoke test results**

```bash
git commit --allow-empty -m "test(equipe): smoke test checklist passed"
```

---

## Self-Review Checklist (run after writing the plan, before handing off)

- [ ] **Spec coverage** — every section of the design spec is implemented:
  - Section 2 (Data model) → Task 1
  - Section 3 (Architecture) → Tasks 4, 9-15
  - Section 4 (RBAC) → Task 5
  - Section 5 (Metrics formulas) → Task 14
  - Section 6 (3 UI views) → Tasks 23, 24, 25
  - Section 7 (Garde-fous: audit log + 24h window + anomalies) → Tasks 12, 17
  - Section 8 (Dependencies, hors-scope, transparency) → Task 26
- [ ] **Placeholder scan** — no "TBD"/"TODO"/"implement later" outside enum values
- [ ] **Type consistency** — `TenantContext.teamRoles` used as `Map<string, TeamRole>` everywhere; `TaskRef` shape consistent across permissions/transitions; `Period` type literal-only (`"7d" | "30d" | "90d" | "12m"`)
- [ ] **Critical commits** — each lib file gets a TDD commit; each API route group commits together; each UI page commits with its supporting components

