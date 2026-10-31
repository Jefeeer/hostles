"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KIND_LABEL, METHOD_LABEL } from "@/lib/constants";
import { PAYMENT_KINDS, PAYMENT_METHODS, type PaymentKind } from "@/lib/types";
import type { FormState } from "../actions";

const sel = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm dark:bg-input/30";

export function PaymentForm({ action, suggestedKind, suggestedAmount, today }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  suggestedKind: PaymentKind;
  suggestedAmount: number;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement>(null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  useEffect(() => {
    if (state && !state.error && !state.fieldErrors) {
      toast.success("Payment recorded");
      form.current?.reset();
    }
  }, [state]);

  return (
    <form ref={form} action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="kind">Type</Label>
        <select id="kind" name="kind" defaultValue={suggestedKind} className={sel}>
          {PAYMENT_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="method">Method</Label>
        <select id="method" name="method" defaultValue="gcash" className={sel}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount (₱)</Label>
        <Input id="amount" name="amount" inputMode="decimal" defaultValue={suggestedAmount || ""} className="tabular h-10" />
        {err("amount") && <p className="text-sm text-destructive">{err("amount")}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="paid_on">Date paid</Label>
        <Input id="paid_on" name="paid_on" type="date" defaultValue={today} className="h-10" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="reference">Reference no.</Label>
        <Input id="reference" name="reference" placeholder="GCash / bank reference" className="h-10" />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <Checkbox name="verified" defaultChecked /> Verified (received in my account)
      </label>
      {state?.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-10 font-semibold sm:col-span-2">{pending ? "Saving…" : "Record payment"}</Button>
    </form>
  );
}
