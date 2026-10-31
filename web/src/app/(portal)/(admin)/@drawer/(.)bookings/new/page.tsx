import { RouteDrawer } from "@/components/route-drawer";
import { NewBooking } from "../../../bookings/new-booking";

/** "New booking" clicked inside the app: open the form in a drawer over the current page. */
export default async function NewBookingDrawer({ searchParams }: PageProps<"/bookings/new">) {
  const { date, client } = await searchParams;
  return (
    <RouteDrawer title="New booking">
      <NewBooking date={date} client={client} />
    </RouteDrawer>
  );
}
