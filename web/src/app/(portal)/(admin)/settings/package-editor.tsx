"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_LABEL } from "@/lib/constants";
import { php } from "@/lib/format";
import { EVENT_TYPES, type Package } from "@/lib/types";
import type { FormState } from "../bookings/actions";

export function PackageEditor({ pkg, action }: { pkg?: Package; action: (p: FormState, fd: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  useEffect(() => {
    if (state && !state.error && !state.fieldErrors) toast.success("Package saved");
  }, [state]);

  return (
    <details className="group rounded-lg border bg-card" open={!pkg}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-3">
        <span className="min-w-0">
          <span className="font-semibold">{pkg?.name ?? "Add a package"}</span>
          {pkg && <span className="ml-2 text-xs text-muted-foreground">{pkg.event_type ? EVENT_LABEL[pkg.event_type] : "Any event"}{!pkg.is_active && " · inactive"}</span>}
        </span>
        {pkg && <span className="tabular shrink-0 text-sm font-semibold">{php(pkg.rate)}</span>}
      </summary>
      <form action={formAction} className="grid gap-3 border-t p-3 sm:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Name</Label>
          <Input name="name" defaultValue={pkg?.name} required className="h-9" />
          {err("name") && <p className="text-sm text-destructive">{err("name")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Event type</Label>
          <select name="event_type" defaultValue={pkg?.event_type ?? ""} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm dark:bg-input/30">
            <option value="">Any</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label>Rate ₱</Label><Input name="rate" inputMode="decimal" defaultValue={pkg?.rate ?? ""} className="tabular h-9" /></div>
          <div className="space-y-1.5"><Label>Hours</Label><Input name="hours" inputMode="decimal" defaultValue={pkg?.hours ?? ""} className="h-9" /></div>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Description</Label>
          <Textarea name="description" rows={3} defaultValue={pkg?.description ?? ""} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Inclusions (one per line)</Label>
          <Textarea name="inclusions" rows={3} defaultValue={pkg?.inclusions.join("\n") ?? ""} />
        </div>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
          <label className="flex items-center gap-2 text-sm"><Checkbox name="is_active" defaultChecked={pkg?.is_active ?? true} /> Active</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox name="is_public" defaultChecked={pkg?.is_public ?? true} /> Show on public booking page</label>
        </div>
        {state?.error && <p className="text-sm text-destructive sm:col-span-4">{state.error}</p>}
        <Button type="submit" disabled={pending} className="font-semibold">{pending ? "Saving…" : "Save"}</Button>
      </form>
    </details>
  );
}
