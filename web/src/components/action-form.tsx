"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/app/(portal)/(admin)/bookings/actions";

/** Form around a server action: shows field errors and a toast on success. Inputs are passed as children. */
export function ActionForm({ action, children, submitLabel = "Save", success = "Saved", className }: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  children: ReactNode;
  submitLabel?: string;
  success?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useEffect(() => {
    if (state && !state.error && !state.fieldErrors) toast.success(success);
  }, [state, success]);
  const errors = state?.fieldErrors ? Object.entries(state.fieldErrors).flatMap(([k, v]) => (v ?? []).map((m) => `${k.replaceAll("_", " ")}: ${m}`)) : [];

  return (
    <form action={formAction} className={className}>
      {children}
      {(state?.error || errors.length > 0) && (
        <div role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state?.error ?? errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={pending} className="font-semibold">{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
