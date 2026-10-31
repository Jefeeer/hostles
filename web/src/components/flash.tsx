"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

/** Shows a toast after a create/save redirect, then cleans the URL. */
export function Flash({ created, saved }: { created: boolean; saved: boolean }) {
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!created && !saved) return;
    toast.success(created ? "Booking created" : "Changes saved");
    router.replace(path, { scroll: false });
  }, [created, saved, path, router]);
  return null;
}
