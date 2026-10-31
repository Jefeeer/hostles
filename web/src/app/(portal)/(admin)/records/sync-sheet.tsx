"use client";

import { useTransition } from "react";
import { Sheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncSheet } from "./actions";

export function SyncSheetButton({ y, m }: { y: number; m: number }) {
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const r = await syncSheet(y, m);
    if (!r.ok) toast.error(`Sheet sync failed: ${r.error}`);
    else if (r.action === "skipped") toast.message(r.reason);
    else toast.success(`${r.tab} synced (${r.rows} bookings)`, { action: { label: "Open", onClick: () => window.open(r.url, "_blank", "noopener") } });
  });
  return <Button variant="outline" disabled={pending} onClick={run}><Sheet /> {pending ? "Syncing…" : "Sync to Sheet"}</Button>;
}
