"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id: string;
  type: "TASK_ASSIGNED" | "TASK_OVERDUE" | "TASK_BLOCKED_LONG" | "TASK_ANOMALY";
  message: string;
  readAt: string | null;
  createdAt: string;
  task: { id: string; title: string };
}

export function NotificationsBell() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    const r = await fetch("/api/equipe/notifications");
    if (!r.ok) return;
    const data: { notifications: Notification[]; unreadCount: number } = await r.json();
    setItems(data.notifications);
    setUnread(data.unreadCount);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  async function open(n: Notification) {
    if (!n.readAt) {
      await fetch(`/api/equipe/notifications/${n.id}/read`, { method: "POST" });
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      );
      setUnread((u) => Math.max(0, u - 1));
    }
    router.push(`/dashboard/equipe/taches/${n.task.id}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex items-center justify-center rounded-md p-2 hover:bg-slate-100">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-4 text-sm text-slate-500 text-center">Aucune notification</div>
        ) : (
          items.slice(0, 20).map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => open(n)}
              className={!n.readAt ? "font-medium" : ""}
            >
              <div className="flex flex-col">
                <span className="text-sm truncate">{n.message}</span>
                <span className="text-xs text-slate-500">
                  {new Date(n.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
