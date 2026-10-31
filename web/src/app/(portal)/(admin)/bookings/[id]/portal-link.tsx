"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPortalLink } from "../actions";

export function PortalLinkButton({ bookingId }: { bookingId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (url) {
    return (
      <div className="space-y-2">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="h-9 text-xs" aria-label="Client page link" />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Link copied"))}>Copy</Button>
          <Button size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noreferrer">Open</a></Button>
        </div>
      </div>
    );
  }
  return (
    <Button variant="outline" className="w-full" disabled={pending} onClick={() => start(async () => setUrl(await createPortalLink(bookingId)))}>
      {pending ? "Creating…" : "Get client page link"}
    </Button>
  );
}
