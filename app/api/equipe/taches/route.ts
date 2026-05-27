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

  if (scope === "mine") {
    where.assigneeId = ctx.userId;
    if (teamId) where.teamId = teamId;
  } else if (scope === "team") {
    const myTeams = Array.from(ctx.teamRoles.keys());
    if (teamId) {
      // Narrow to that specific team only if user belongs to it.
      if (!myTeams.includes(teamId)) {
        return NextResponse.json([], { status: 200 });
      }
      where.teamId = teamId;
    } else {
      where.teamId = { in: myTeams };
    }
  } else if (scope === "all") {
    if (ctx.orgRole !== "OWNER" && ctx.orgRole !== "ADMIN") {
      return NextResponse.json({ error: "Interdit" }, { status: 403 });
    }
    if (teamId) where.teamId = teamId;
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
