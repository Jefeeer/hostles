import { getRules } from "@/lib/settings";
import { listClients, listPackages, requireAdmin } from "@/lib/data";
import { createBooking } from "./actions";
import { BookingForm } from "./booking-form";

/** The new-booking form, used by the full page and the drawer. */
export async function NewBooking({ date, client }: { date?: string | string[]; client?: string | string[] }) {
  const supabase = await requireAdmin();
  const [clients, packages, rules] = await Promise.all([listClients(supabase), listPackages(supabase, { activeOnly: true }), getRules(supabase)]);
  return (
    <BookingForm
      action={createBooking}
      clients={clients}
      packages={packages}
      defaultDate={typeof date === "string" ? date : undefined}
      initialClientId={typeof client === "string" ? client : undefined}
      submitLabel="Create booking"
      depositPercent={rules.deposit_percent}
    />
  );
}
