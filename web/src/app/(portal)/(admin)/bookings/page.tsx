import Link from "next/link";
import type { Metadata } from "next";
import { subDays, format } from "date-fns";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { listBookings, requireAdmin } from "@/lib/data";
import { parseDay, todayISO } from "@/lib/format";
import { Kanban } from "./kanban";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const supabase = await requireAdmin();
  // Active pipeline + anything that happened in the last 30 days (so "Done" and
  // "Cancelled" stay useful without growing forever; older ones live in Records).
  const since = format(subDays(parseDay(todayISO()), 30), "yyyy-MM-dd");
  const [active, recent] = await Promise.all([
    listBookings(supabase, { statuses: ["inquiry", "on_hold", "contract_sent", "signed", "deposit_paid", "fully_paid"] }),
    listBookings(supabase, { statuses: ["done", "cancelled"], from: since }),
  ]);

  return (
    <>
      <PageHeader
        title="Bookings"
        description="Drag a card to move it through the pipeline. On your phone, use the ⋯ menu on each card."
        actions={
          <Button asChild className="font-semibold">
            <Link href="/bookings/new"><Plus /> New booking</Link>
          </Button>
        }
      />
      <Kanban initial={[...active, ...recent]} />
    </>
  );
}
