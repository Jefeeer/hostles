import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Copy, Download } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { EmptyState, PageHeader, Stat } from "@/components/bits";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_LABEL } from "@/lib/constants";
import { requireAdmin } from "@/lib/data";
import { editionTotals, entryFee, fieldDefsToText, type Edition, type Entry, type FieldDef } from "@/lib/events";
import { fmtDate, fmtTimeRange, php } from "@/lib/format";
import type { BookingFinancials } from "@/lib/types";
import { convertEntry, deleteEdition, deleteEntry, duplicateEditionAction, saveEdition, saveEntry, saveFields } from "../actions";
import { EditionFields, STATUS_CHIP } from "../edition-fields";

export const metadata: Metadata = { title: "Special event" };

export default async function EditionPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data: e } = await supabase.from("event_editions").select("*").eq("id", id).maybeSingle<Edition>();
  if (!e) notFound();
  const [{ data: entries }, { data: series }] = await Promise.all([
    supabase.from("edition_entries").select("*").eq("edition_id", id).order("created_at"),
    supabase.from("event_series").select("id, name").order("created_at"),
  ]);
  const ents = (entries ?? []) as Entry[];
  const bookingIds = ents.map((x) => x.booking_id).filter((b): b is string => !!b);
  const { data: fins } = bookingIds.length ? await supabase.from("booking_financials").select("*").in("booking_id", bookingIds) : { data: [] };
  const fin = new Map(((fins ?? []) as BookingFinancials[]).map((f) => [f.booking_id, f]));
  const t = editionTotals(e, ents, fin);
  const perEntry = e.fee_mode === "per_entry";
  const seriesName = series?.find((s) => s.id === e.series_id)?.name;

  return (
    <div className="mx-auto max-w-5xl">
      <p className="mb-1 text-sm"><Link href="/events" className="text-muted-foreground hover:text-foreground">Special events</Link>{seriesName && <span className="text-muted-foreground"> / {seriesName}</span>}</p>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{e.name}<span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_CHIP[e.status]}`}>{e.status}</span></span>}
        description={`${fmtDate(e.event_date, "EEEE, MMMM d, yyyy")}${e.start_time ? ` · ${fmtTimeRange(e.start_time, e.end_time)}` : ""}${e.venue ? ` · ${e.venue}` : ""} · ${EVENT_LABEL[e.event_type]}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><a href={`/events/${e.id}/export`}><Download /> CSV</a></Button>
            <form action={duplicateEditionAction.bind(null, e.id)}><Button variant="outline" type="submit"><Copy /> Duplicate for next year</Button></form>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Entries" value={t.entries} />
        <Stat label={perEntry ? `Fees (${php(e.per_entry_fee)} each)` : "Flat fee"} value={php(t.expected)} />
        <Stat label="Collected" value={php(t.collected)} accent />
        <Stat label="Outstanding" value={php(Math.max(t.expected - t.collected, 0))} />
      </div>

      <section aria-labelledby="entries" className="mb-8">
        <h2 id="entries" className="mb-3 text-lg font-bold">Entries</h2>
        {ents.length === 0 ? <EmptyState>No entries yet. Add the first one below.</EmptyState> : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th>
                  {e.fields.map((f) => <th key={f.key} className="px-3 py-2 whitespace-nowrap">{f.label}</th>)}
                  {perEntry && <><th className="px-3 py-2 text-right">Fee</th><th className="px-3 py-2 text-right">Paid</th></>}
                  <th className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ents.map((x, i) => {
                  const paid = x.booking_id ? (fin.get(x.booking_id)?.paid ?? 0) : x.paid;
                  return (
                    <tr key={x.id} className="align-top">
                      <td className="px-3 py-2 text-muted-foreground tabular">{i + 1}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold">{x.name}</p>
                        {(x.contact || x.email) && <p className="text-xs text-muted-foreground">{[x.contact, x.email].filter(Boolean).join(" · ")}</p>}
                      </td>
                      {e.fields.map((f) => <td key={f.key} className="px-3 py-2">{x.data[f.key] ?? ""}</td>)}
                      {perEntry && <>
                        <td className="px-3 py-2 text-right tabular">{php(entryFee(e, x))}</td>
                        <td className={`px-3 py-2 text-right tabular ${paid >= entryFee(e, x) ? "text-emerald-700 dark:text-emerald-300" : ""}`}>{php(paid)}</td>
                      </>}
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          {x.booking_id
                            ? <Button asChild size="sm" variant="ghost"><Link href={`/bookings/${x.booking_id}`}>Booking →</Link></Button>
                            : <form action={convertEntry.bind(null, e.id, x.id)}><Button size="sm" variant="ghost" type="submit">Make booking</Button></form>}
                          <details className="relative">
                            <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-sm font-medium hover:bg-muted">Edit</summary>
                            <div className="absolute right-0 z-20 mt-1 w-80 rounded-xl border bg-popover p-4 shadow-lg">
                              <ActionForm action={saveEntry.bind(null, e.id, x.id)} success="Entry saved">
                                <EntryInputs fields={e.fields} x={x} perEntry={perEntry} converted={!!x.booking_id} />
                              </ActionForm>
                              <ConfirmButton action={deleteEntry.bind(null, e.id, x.id)} title={`Remove ${x.name}?`} description={x.booking_id ? "The booking made from it stays." : undefined} variant="ghost" size="sm" className="mt-2 text-destructive">Remove entry</ConfirmButton>
                            </div>
                          </details>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <details className="mt-3 rounded-xl border bg-card" open={ents.length === 0}>
          <summary className="cursor-pointer p-4 font-semibold">+ Add entry</summary>
          <div className="border-t p-4">
            {/* key: remount (clear the form) after each added entry */}
            <ActionForm key={ents.length} action={saveEntry.bind(null, e.id, null)} submitLabel="Add entry" success="Entry added">
              <EntryInputs fields={e.fields} perEntry={perEntry} />
            </ActionForm>
          </div>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="font-bold">Entry fields</h2>
          <p className="mb-3 text-sm text-muted-foreground">One per line: <code>Label | type | options</code>. Types: text, number, date, select (options separated by commas).</p>
          <ActionForm action={saveFields.bind(null, e.id)} success="Fields saved">
            <Textarea name="fields" aria-label="Entry fields" rows={6} defaultValue={fieldDefsToText(e.fields)} className="font-mono text-sm" placeholder={"Groom\nBride\nLicense | select | Pending, Approved"} />
          </ActionForm>
        </section>

        <section className="rounded-xl border bg-card p-4 sm:p-6">
          <h2 className="mb-3 font-bold">Edition details</h2>
          <ActionForm action={saveEdition.bind(null, e.id)} success="Edition saved">
            <EditionFields e={e} series={series ?? []} />
          </ActionForm>
          <ConfirmButton action={deleteEdition.bind(null, e.id)} title={`Delete ${e.name}?`} description="Its entries are deleted too. Bookings made from entries stay." variant="ghost" size="sm" className="mt-3 text-destructive">Delete edition</ConfirmButton>
        </section>
      </div>
    </div>
  );
}

function EntryInputs({ fields, x, perEntry, converted }: { fields: FieldDef[]; x?: Entry; perEntry: boolean; converted?: boolean }) {
  const p = x?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <In id={`${p}-name`} name="name" label="Name" value={x?.name} required />
      <In id={`${p}-contact`} name="contact" label="Contact no." value={x?.contact} />
      <In id={`${p}-email`} name="email" label="Email" type="email" value={x?.email} />
      {fields.map((f) => f.type === "select" ? (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`${p}-${f.key}`}>{f.label}</Label>
          <select id={`${p}-${f.key}`} name={`f_${f.key}`} defaultValue={x?.data[f.key] ?? ""} className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm dark:bg-input/30">
            <option value="">-</option>
            {f.options?.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
      ) : (
        <In key={f.key} id={`${p}-${f.key}`} name={`f_${f.key}`} label={f.label} type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={x?.data[f.key]} />
      ))}
      {perEntry && <In id={`${p}-fee`} name="fee" label="Fee ₱ (blank = default)" value={x?.fee ?? ""} inputMode="decimal" />}
      {perEntry && !converted && <In id={`${p}-paid`} name="paid" label="Paid ₱" value={x?.paid || ""} inputMode="decimal" />}
    </div>
  );
}

function In({ id, label, value, ...props }: { id: string; label: string; value?: string | number | null } & Omit<React.ComponentProps<typeof Input>, "value">) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} defaultValue={value ?? ""} {...props} />
    </div>
  );
}
