"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** A button that asks before running a destructive server action. */
export function ConfirmButton({ action, title, description, confirmLabel = "Delete", children, ...buttonProps }: {
  action: () => Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "action">) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...buttonProps}>{children}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Never mind</Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await action();
                  setOpen(false);
                } catch (e) {
                  // redirect() throws by design; let it through.
                  if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e;
                  toast.error("Something went wrong. Please try again.");
                }
              })
            }
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
