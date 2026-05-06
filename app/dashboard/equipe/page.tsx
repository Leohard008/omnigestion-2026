import Link from "next/link";
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
  const where: Record<string, unknown> = { organizationId: ctx.orgId, assigneeId: ctx.userId };
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
        {canCreate && <NewTaskButton userId={ctx.userId} />}
      </header>
      <CollabMetrics userId={ctx.userId} />
      <TaskFilters current={status} />
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune tâche.</p>
        ) : (
          tasks.map((t) => <TaskCard key={t.id} task={{ ...t, estimatedHours: t.estimatedHours ? Number(t.estimatedHours) : null }} />)
        )}
      </div>
      <footer className="pt-6 mt-6 border-t text-xs text-slate-500">
        <Link href="/dashboard/equipe/comment-ca-marche" className="hover:underline">
          ℹ Comment fonctionne ce module
        </Link>
      </footer>
    </div>
  );
}
