import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { requireAdmin } from "@/lib/data";
import type { Edition } from "@/lib/events";
import { saveEdition } from "./actions";
import { EditionFields } from "./edition-fields";

/** The new-edition form, used by the full page and the drawer. */
export async function NewEdition({ seriesId }: { seriesId?: string | string[] }) {
  const supabase = await requireAdmin();
  const { data: series } = await supabase.from("event_series").select("id, name").order("created_at");
  if (!series?.length) redirect("/events");
  const preset = { series_id: typeof seriesId === "string" ? seriesId : series[0].id } as Edition;
  return (
    <ActionForm action={saveEdition.bind(null, null)} submitLabel="Create edition">
      <EditionFields e={preset} series={series} />
    </ActionForm>
  );
}
