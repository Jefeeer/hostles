"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { JobReport } from "@/lib/reminders";
import { runRemindersNow } from "./actions";

export function RunRemindersButton() {
  const [report, setReport] = useState<JobReport | null>(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => {
    const r = await runRemindersNow();
    setReport(r);
    toast.success(`${r.sent.length} sent · ${r.actions.length} actions`);
  });
  return (
    <div className="space-y-3">
      <Button variant="outline" disabled={pending} onClick={run}>{pending ? "Running…" : "Run today's reminders now"}</Button>
      {report && (
        <ul className="space-y-1 rounded-lg bg-muted p-3 text-sm">
          {[...report.sent.map((s) => `Sent: ${s}`), ...report.actions, ...report.skipped.map((s) => `Skipped: ${s}`)].map((l, i) => <li key={i}>{l}</li>)}
          {!report.sent.length && !report.actions.length && !report.skipped.length && <li>Nothing due today (already-sent reminders are never repeated).</li>}
        </ul>
      )}
    </div>
  );
}
