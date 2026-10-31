import type { Metadata } from "next";
import { PageHeader } from "@/components/bits";
import { NewEdition } from "../new-edition";

export const metadata: Metadata = { title: "New edition" };

export default async function NewEditionPage({ searchParams }: PageProps<"/events/new">) {
  const { series } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New edition" description="You can add custom entry fields on the next screen." />
      <div className="rounded-xl border bg-card p-4 sm:p-6"><NewEdition seriesId={series} /></div>
    </div>
  );
}
