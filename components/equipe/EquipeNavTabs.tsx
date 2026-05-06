import Link from "next/link";
import type { TenantContext } from "@/lib/tasks/types";

interface Props {
  ctx: TenantContext;
  current: "mine" | "manager" | "teams";
}

/**
 * Navigation tabs shown at the top of equipe pages.
 * Visibility depends on the user's role.
 */
export function EquipeNavTabs({ ctx, current }: Props) {
  const isAdmin = ctx.orgRole === "OWNER" || ctx.orgRole === "ADMIN";
  const isManager = Array.from(ctx.teamRoles.values()).includes("MANAGER");

  const tabs: { key: Props["current"]; href: string; label: string; show: boolean }[] = [
    { key: "mine", href: "/dashboard/equipe", label: "Mes tâches", show: true },
    {
      key: "manager",
      href: "/dashboard/equipe/manager",
      label: "Tableau d'équipe",
      show: isAdmin || isManager,
    },
    {
      key: "teams",
      href: "/dashboard/equipe/equipes",
      label: "Gérer les équipes",
      show: isAdmin,
    },
  ];

  return (
    <nav className="flex gap-1 border-b">
      {tabs
        .filter((t) => t.show)
        .map((t) => {
          const active = t.key === current;
          return (
            <Link
              key={t.key}
              href={t.href}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? "border-slate-900 text-slate-900 font-medium"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}
