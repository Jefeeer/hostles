import Link from "next/link";
import type { Metadata } from "next";
import { Plus, Search } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listClients, requireAdmin } from "@/lib/data";
import { fmtDate, todayISO } from "@/lib/format";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";
  const supabase = await requireAdmin();
  const [clients, { data: events }] = await Promise.all([
    listClients(supabase, search || undefined),
    supabase.from("bookings").select("client_id, event_date, status").neq("status", "cancelled").order("event_date"),
  ]);

  const today = todayISO();
  const stats = new Map<string, { count: number; next?: string; last?: string }>();
  for (const e of events ?? []) {
    const s = stats.get(e.client_id) ?? { count: 0 };
    s.count++;
    if (e.event_date >= today) s.next ??= e.event_date;
    else s.last = e.event_date;
    stats.set(e.client_id, s);
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${clients.length} ${search ? "matching" : "total"}`}
        actions={<Button asChild className="font-semibold"><Link href="/clients/new"><Plus /> New client</Link></Button>}
      />
      <form className="relative mb-4 max-w-sm" role="search">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={search} placeholder="Search by name…" aria-label="Search clients" className="h-10 pl-9" />
      </form>

      {clients.length === 0 ? (
        <EmptyState>No clients found.</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => {
            const s = stats.get(c.id);
            return (
              <li key={c.id}>
                <Link href={`/clients/${c.id}`} className="block h-full rounded-xl border bg-card p-4 transition-colors hover:border-brand/50">
                  <p className="font-semibold">{c.full_name}{c.partner_name && <span className="font-normal text-muted-foreground"> & {c.partner_name}</span>}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{[c.phone, c.email].filter(Boolean).join(" · ") || "No contact details"}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {s?.count ?? 0} booking{s?.count === 1 ? "" : "s"}
                    {s?.next && <> · <span className="font-semibold text-brand-deep dark:text-brand">next {fmtDate(s.next, "MMM d, yyyy")}</span></>}
                    {!s?.next && s?.last && <> · last {fmtDate(s.last, "MMM yyyy")}</>}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
