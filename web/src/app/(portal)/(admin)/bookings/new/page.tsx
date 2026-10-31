import type { Metadata } from "next";
import { PageHeader } from "@/components/bits";
import { NewBooking } from "../new-booking";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: PageProps<"/bookings/new">) {
  const { date, client } = await searchParams;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New booking" description="Captured once: records, calendar and reminders all build on this." />
      <NewBooking date={date} client={client} />
    </div>
  );
}
