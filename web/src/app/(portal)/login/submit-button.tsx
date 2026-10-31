"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

/** Shows that sign-in is working, so the page never looks frozen. */
export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="h-11 w-full text-sm font-bold tracking-[0.12em] uppercase">
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}
