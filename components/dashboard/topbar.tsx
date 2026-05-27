"use client";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { NotificationsBell } from "@/components/equipe/NotificationsBell";

export function Topbar({ user, organizationName }: { user: any; organizationName: string }) {
  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <NotificationsBell />
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/auth/login" })}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
