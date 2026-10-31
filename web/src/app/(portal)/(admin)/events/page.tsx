import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { EmptyState, PageHeader } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/data";
import { editionTotals, type Edition, type Entry } from "@/lib/events";
import { fmtDate, php } from "@/lib/format";
import type { BookingFinancials } from "@/lib/types";
import { createSeries } from "./actions";
import { STATUS_CHIP } from "./edition-fields";

export const metadata: Metadata = { title: "Special events" };

export default async function EventsPage() {
  const supabase = await requireAdmin();
  const [{ data: series }, { data: editions }, { data: entries }, { data: fins }] = await Promise.all([
    supabase.from("event_series").select("id, name, description").order("created_at"),
    supabase.from("event_editions").select("*").order("event_date", { ascending: false }),
    supabase.from("edition_entries").select("id, edition_id, fee, paid, booking_id"),
    supabase.from("booking_financials").select("*"),
  ]);
  const fin = new Map(((fins ?? []) as BookingFinancials[]).map((f) => [f.booking_id, f]));
  const eds = (editions ?? []) as Edition[];
  const ents = (entries ?? []) as Entry[];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Special events" description="Recurring events like Kasalang Tagaytay: one series, an edition per year."
        actions={(series?.length ?? 0) > 0 && <Button asChild><Link href="/events/new"><Plus /> New edition</Link></Button>} />

      <div className="space-y-8">
        {(series ?? []).map((s) => {
          const mine = eds.filter((e) => e.series_id === s.id);
          return (
            <section key={s.id} aria-labelledby={`s-${s.id}`}>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id={`s-${s.id}`} className="text-lg font-bold">{s.name}</h2>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                </div>
                <Button asChild variant="outline" size="sm"><Link href={`/events/new?series=${s.id}`}><Plus /> Edition</Link></Button>
              </div>
              {mine.length === 0 ? <EmptyState>No editions yet.</EmptyState> : (
                <ul className="divide-y rounded-xl border bg-card">
                  {mine.map((e) => {
                    const t = editionTotals(e, ents.filter((x) => x.edition_id === e.id), fin);
                    return (
                      <li key={e.id}>
                        <Link href={`/events/${e.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/50">
                          <div>
                            <p className="font-semibold">{e.name}</p>
                            <p className="text-sm text-muted-foreground">{fmtDate(e.event_date, "EEE, MMM d, yyyy")}{e.venue && ` · ${e.venue}`}</p>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="tabular">{t.entries} {t.entries === 1 ? "entry" : "entries"}</span>
                            <span className="tabular">{php(t.collected)} <span className="text-muted-foreground">/ {php(t.expected)}</span></span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_CHIP[e.status]}`}>{e.status}</span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}

        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="font-bold">New series</h2>
          <ActionForm action={createSeries} success="Series added" submitLabel="Add series">
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required placeholder="e.g. Kasalang Bayan Silang" /></div>
              <div className="space-y-1.5"><Label htmlFor="description">Description</Label><Input id="description" name="description" /></div>
            </div>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
