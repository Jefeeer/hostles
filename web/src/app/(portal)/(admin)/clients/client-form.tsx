"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Client } from "@/lib/types";
import type { FormState } from "../bookings/actions";

export function ClientForm({ action, client }: { action: (p: FormState, fd: FormData) => Promise<FormState>; client?: Client }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const input = (name: keyof Client, label: string, props: React.ComponentProps<"input"> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={(client?.[name] as string) ?? ""} className="h-10" {...props} />
      {err(name) && <p className="text-sm text-destructive">{err(name)}</p>}
    </div>
  );
  const area = (name: keyof Client, label: string, hint: string) => (
    <div className="space-y-1.5 sm:col-span-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} rows={4} defaultValue={(client?.[name] as string) ?? ""} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</p>}
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-6">
        {input("full_name", "Name", { required: true })}
        {input("partner_name", "Partner (for couples)")}
        {input("phone", "Mobile", { type: "tel", inputMode: "tel" })}
        {input("email", "Email", { type: "email" })}
        {input("facebook", "Facebook / Messenger")}
        {input("city", "City")}
      </div>
      <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-6">
        {area("pronunciation_notes", "Names & pronunciation", "Exactly how to say names on the mic: couple, parents, sponsors.")}
        {area("story", "Their story", "How they met, the proposal, inside jokes: material for spiels.")}
        {area("program_notes", "Program flow", "Entourage order, special segments, songs, things to avoid.")}
        {area("notes", "Other notes", "Anything else.")}
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending} className="min-w-32 font-semibold">{pending ? "Saving…" : "Save client"}</Button>
      </div>
    </form>
  );
}
