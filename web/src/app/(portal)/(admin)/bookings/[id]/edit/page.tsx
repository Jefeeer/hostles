import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/bits";
import { getRules } from "@/lib/settings";
import { getBooking, listClients, listPackages, requireAdmin } from "@/lib/data";
import { updateBooking } from "../../actions";
import { BookingForm } from "../../booking-form";

export const metadata: Metadata = { title: "Edit booking" };

export default async function EditBookingPage({ params }: PageProps<"/bookings/[id]/edit">) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const [booking, clients, packages, rules] = await Promise.all([getBooking(supabase, id), listClients(supabase), listPackages(supabase), getRules(supabase)]);
  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={`Edit ${booking.ref}`} description={booking.title ?? undefined} />
      <BookingForm action={updateBooking.bind(null, id)} clients={clients} packages={packages} booking={booking} submitLabel="Save changes" depositPercent={rules.deposit_percent} />
    </div>
  );
}
