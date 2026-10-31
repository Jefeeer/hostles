import { RouteDrawer } from "@/components/route-drawer";
import { requireAdmin } from "@/lib/data";
import { saveClient } from "../../../clients/actions";
import { ClientForm } from "../../../clients/client-form";

export default async function NewClientDrawer() {
  await requireAdmin();
  return (
    <RouteDrawer title="New client">
      <ClientForm action={saveClient.bind(null, null)} />
    </RouteDrawer>
  );
}
