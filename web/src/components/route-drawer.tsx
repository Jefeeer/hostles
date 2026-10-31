"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * Right-side drawer whose open state is the URL. Closing goes back (intercepted routes)
 * or to `closeHref` (a ?param drawer on the same page).
 */
export function RouteDrawer({ title, description, closeHref, children }: { title: ReactNode; description?: ReactNode; closeHref?: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // A parallel-route slot keeps its last content when you navigate elsewhere (e.g. after
  // saving), so only show while the URL is still the one this drawer opened on.
  const [openedOn] = useState(pathname);
  if (pathname !== openedOn) return null;
  return (
    <Sheet open onOpenChange={(open) => {
      if (open) return;
      if (closeHref) router.replace(closeHref, { scroll: false });
      else router.back();
    }}>
      {/* [&_.sticky]: the forms' sticky save bars sit at the drawer's bottom edge, not above the phone tab bar */}
      <SheetContent className="gap-0 data-[side=right]:w-full overflow-y-auto data-[side=right]:sm:max-w-xl [&_.sticky]:bottom-0">
        <SheetHeader className="border-b pr-12">
          <SheetTitle className="text-lg">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
