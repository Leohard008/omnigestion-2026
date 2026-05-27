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
