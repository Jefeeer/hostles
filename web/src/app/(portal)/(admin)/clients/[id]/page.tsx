import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { EventTypeTag, StatusBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, METHOD_LABEL } from "@/lib/constants";
import { listBookings, requireAdmin } from "@/lib/data";
import { fmtDate, php } from "@/lib/format";
import type { Client, Payment } from "@/lib/types";
import { Flash } from "@/components/flash";
import { saveClient } from "../actions";
import { ClientForm } from "../client-form";

export async function generateMetadata({ params }: PageProps<"/clients/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data } = await supabase.from("clients").select("full_name").eq("id", id).maybeSingle();
  return { title: data?.full_name ?? "Client" };
}

export default async function ClientPage({ params, searchParams }: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const supabase = await requireAdmin();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  const bookings = await listBookings(supabase, { clientId: id });
  const { data: payments } = bookings.length
    ? await supabase.from("payments").select("*").in("booking_id", bookings.map((b) => b.id)).order("paid_on", { ascending: false })
    : { data: [] };
  const title = new Map(bookings.map((b) => [b.id, b.title ?? b.ref]));
  const owed = bookings.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.fin.balance, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <Flash created={false} saved={!!saved} />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{client.full_name}{client.partner_name && <span className="text-muted-foreground"> & {client.partner_name}</span>}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{bookings.length} booking{bookings.length === 1 ? "" : "s"}{owed > 0 && <> · <span className="font-semibold text-foreground">{php(owed)} outstanding</span></>}</p>
        </div>
        <Button asChild className="font-semibold"><Link href={`/bookings/new?client=${id}`}><Plus /> Book again</Link></Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ClientForm action={saveClient.bind(null, id)} client={client as Client} />

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-deep uppercase dark:text-brand">Bookings</h2>
            <ul className="space-y-2">
              {bookings.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="block rounded-lg border p-3 hover:bg-muted/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold">{b.title ?? b.ref}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{fmtDate(b.event_date, "MMM d, yyyy")}</span>
                      <EventTypeTag type={b.event_type} />
                      <span className="tabular">{php(b.rate)}{b.fin.balance > 0 && ` · ${php(b.fin.balance)} due`}</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold tracking-wide text-brand-deep uppercase dark:text-brand">Payment history</h2>
            {(payments ?? []).length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
            <ul className="divide-y text-sm">
              {((payments ?? []) as Payment[]).map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{title.get(p.booking_id)}</p>
                    <p className="text-xs text-muted-foreground">{KIND_LABEL[p.kind]} · {METHOD_LABEL[p.method]} · {fmtDate(p.paid_on, "MMM d, yyyy")}{!p.verified_at && " · unverified"}</p>
                  </div>
                  <span className="tabular shrink-0 font-semibold">{php(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
