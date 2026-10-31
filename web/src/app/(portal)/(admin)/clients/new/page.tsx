import type { Metadata } from "next";
import { PageHeader } from "@/components/bits";
import { requireAdmin } from "@/lib/data";
import { saveClient } from "../actions";
import { ClientForm } from "../client-form";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="New client" />
      <ClientForm action={saveClient.bind(null, null)} />
    </div>
  );
}
