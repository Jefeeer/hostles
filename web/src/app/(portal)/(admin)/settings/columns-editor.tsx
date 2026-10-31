"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SheetColumn } from "@/lib/types";
import { cn } from "@/lib/utils";
import { saveSheetColumns } from "./actions";

export function ColumnsEditor({ initial }: { initial: SheetColumn[] }) {
  const [cols, setCols] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(cols) !== JSON.stringify(initial);

  const update = (i: number, patch: Partial<SheetColumn>) => setCols((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const move = (i: number, d: -1 | 1) =>
    setCols((cs) => {
      const next = [...cs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <div>
      <ol className="divide-y rounded-lg border">
        {cols.map((c, i) => (
          <li key={c.key} className={cn("flex items-center gap-2 p-2", !c.visible && "bg-muted/40")}>
            <span className="tabular w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
            <Input value={c.label} onChange={(e) => update(i, { label: e.target.value })} aria-label={`Label for ${c.key}`}
              className={cn("h-9 flex-1", !c.visible && "text-muted-foreground")} />
            <span className="hidden w-24 truncate text-xs text-muted-foreground sm:block">{c.key}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={c.visible ? "Hide column" : "Show column"} aria-pressed={c.visible}
              onClick={() => update(i, { visible: !c.visible })}>
              {c.visible ? <Eye /> : <EyeOff className="text-muted-foreground" />}
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === cols.length - 1} onClick={() => move(i, 1)}><ArrowDown /></Button>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" disabled={!dirty || pending} onClick={() => setCols(initial)}>Reset</Button>
        <Button disabled={!dirty || pending} className="font-semibold"
          onClick={() => start(async () => {
            try {
              await saveSheetColumns(cols);
              toast.success("Columns saved");
            } catch {
              toast.error("Couldn't save. Labels can't be empty.");
            }
          })}>
          {pending ? "Saving…" : "Save columns"}
        </Button>
      </div>
    </div>
  );
}
