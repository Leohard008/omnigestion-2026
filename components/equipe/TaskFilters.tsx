"use client";
import { useRouter, usePathname } from "next/navigation";

const FILTERS = [
  { value: undefined, label: "Tous" },
  { value: "TODO", label: "À faire" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "BLOCKED", label: "Bloquées" },
  { value: "DONE", label: "Terminées" },
] as const;

export function TaskFilters({ current }: { current?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function setStatus(value?: string) {
    const url = value ? `${pathname}?status=${value}` : pathname;
    router.push(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => {
        const active = (current ?? undefined) === f.value;
        return (
          <button
            key={f.label}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`text-xs px-3 py-1 rounded ${
              active ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
