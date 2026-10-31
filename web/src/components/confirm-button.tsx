"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** The confirm box itself (hostles admin style): round icon, title, message, Cancel + confirm. */
export function ConfirmContent({ icon = <Trash2 />, title, description, confirmLabel, pending, onCancel, onConfirm }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogContent showCloseButton={false} className="max-w-[400px] gap-0 p-7 text-center">
      <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-destructive/12 text-destructive [&_svg]:size-5" aria-hidden>{icon}</span>
      <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
      {description && <DialogDescription className="mt-2 text-sm">{description}</DialogDescription>}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="h-10" autoFocus onClick={onCancel}>Cancel</Button>
        <Button className="h-10 bg-destructive font-semibold text-white hover:bg-destructive/85" disabled={pending} onClick={onConfirm}>
          {pending ? "Working…" : confirmLabel}
        </Button>
      </div>
    </DialogContent>
  );
}

/** A button that asks before running a destructive server action (delete, log out, disconnect...). */
export function ConfirmButton({ action, title, description, confirmLabel = "Delete", icon, children, ...buttonProps }: {
  action: () => Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  icon?: ReactNode;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof Button>, "action">) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button {...buttonProps}>{children}</Button>
      </DialogTrigger>
      <ConfirmContent
        icon={icon}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
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
      />
    </Dialog>
  );
}
