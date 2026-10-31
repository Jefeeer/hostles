"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/constants";
import { BOOKING_STATUSES, EVENT_TYPES } from "@/lib/types";
import { cn } from "@/lib/utils";

const sel = "h-9 rounded-lg border border-input bg-background px-2.5 text-sm dark:bg-input/30";

export function RecordsFilters() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  function set(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${path}?${next}`, { scroll: false });
  }

  // Debounced search.
  useEffect(() => {
    if (q === (sp.get("q") ?? "")) return;
    const t = setTimeout(() => set("q", q.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["type", "status", "pay", "q"].some((k) => sp.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-56">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client or venue" aria-label="Search client or venue" className="h-9 pl-8" />
      </div>
      <select aria-label="Event type" className={sel} value={sp.get("type") ?? ""} onChange={(e) => set("type", e.target.value)}>
        <option value="">All events</option>
        {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
      </select>
      <select aria-label="Status" className={sel} value={sp.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
        <option value="">All statuses</option>
        {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      <select aria-label="Payment" className={sel} value={sp.get("pay") ?? ""} onChange={(e) => set("pay", e.target.value)}>
        <option value="">Any payment</option>
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partial</option>
        <option value="paid">Paid</option>
      </select>
      <button
        type="button"
        onClick={() => {
          setQ("");
          const next = new URLSearchParams();
          for (const k of ["y", "m", "view"]) if (sp.get(k)) next.set(k, sp.get(k)!);
          router.replace(`${path}?${next}`, { scroll: false });
        }}
        className={cn("inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground hover:bg-muted", !active && "invisible")}
      >
        <X className="size-4" /> Clear
      </button>
    </div>
  );
}
