"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Users, Package, FileText, FileCheck, Receipt, Settings } from "lucide-react";
import type { Organization } from "@prisma/client";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clients", icon: Users },
  { href: "/dashboard/produits", label: "Produits", icon: Package },
  { href: "/dashboard/factures", label: "Factures", icon: FileText },
  { href: "/dashboard/devis", label: "Devis", icon: FileCheck },
  { href: "/dashboard/depenses", label: "Dépenses", icon: Receipt },
  { href: "/dashboard/parametres", label: "Paramètres", icon: Settings },
];

export function SidebarNav({ organization }: { organization: Organization }) {
  const pathname = usePathname();
  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="font-bold text-lg text-white">OmniGestion</h1>
        <p className="text-slate-400 text-sm truncate">{organization.name}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">OmniGestion 2026</p>
      </div>
    </aside>
  );
}
