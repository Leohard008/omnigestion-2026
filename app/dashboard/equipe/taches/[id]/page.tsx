import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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
  if (ctx.orgRole === "VIEWER") redirect("/dashboard");
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
        <TaskTimeline events={task.events} sessions={task.sessions} />
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Sessions</h2>
        <SessionsEditor
          taskId={task.id}
          sessions={task.sessions.map((s) => ({
            id: s.id,
            userId: s.userId,
            startedAt: s.startedAt.toISOString(),
            endedAt: s.endedAt ? s.endedAt.toISOString() : null,
            durationSeconds: s.durationSeconds,
            isEdited: s.isEdited,
            editLockedAt: s.editLockedAt ? s.editLockedAt.toISOString() : null,
            edits: s.edits.map((ed) => ({
              id: ed.id,
              oldDurationSec: ed.oldDurationSec,
              newDurationSec: ed.newDurationSec,
              reason: ed.reason,
              editedAt: ed.editedAt.toISOString(),
              editedBy: ed.editedBy,
            })),
          }))}
        />
      </section>

      <footer className="pt-6 mt-6 border-t text-xs text-slate-500">
        <Link href="/dashboard/equipe/comment-ca-marche" className="hover:underline">
          ℹ Comment fonctionne ce module
        </Link>
      </footer>
    </div>
  );
}
