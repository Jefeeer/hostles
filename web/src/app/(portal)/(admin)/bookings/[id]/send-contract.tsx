"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendContract } from "../actions";

export function SendContractButton({ bookingId, label }: { bookingId: string; label: string }) {
  const [pending, start] = useTransition();
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  return (
    <div>
      <Button
        disabled={pending}
        className="w-full font-semibold"
        onClick={() =>
          start(async () => {
            const r = await sendContract(bookingId);
            if (r.conflicts) setConflicts(r.conflicts);
            else (r.ok ? toast.success : toast.error)(r.message);
          })
        }
      >
        {pending ? "Generating…" : label}
      </Button>
      {conflicts && (
        <div className="mt-2 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
          <p className="font-semibold">Date conflict. Fix it or move the card on the board with “Book anyway”:</p>
          <ul className="list-disc pl-4">{conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
