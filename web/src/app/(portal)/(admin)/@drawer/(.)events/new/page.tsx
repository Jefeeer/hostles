import { RouteDrawer } from "@/components/route-drawer";
import { NewEdition } from "../../../events/new-edition";

export default async function NewEditionDrawer({ searchParams }: PageProps<"/events/new">) {
  const { series } = await searchParams;
  return (
    <RouteDrawer title="New edition" description="You can add custom entry fields after creating it.">
      <NewEdition seriesId={series} />
    </RouteDrawer>
  );
}
