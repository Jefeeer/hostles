import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CircleCheck, Clock, Mail, MapPin, Pencil, Phone, Users } from "lucide-react";
import type { ReactNode } from "react";
import { EventTypeTag, PaymentTag, StatusBadge } from "@/components/bits";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, METHOD_LABEL } from "@/lib/constants";
import { getBooking, requireAdmin } from "@/lib/data";
import { fmtDate, fmtStamp, fmtTimeRange, php, todayISO } from "@/lib/format";
import type { ActivityLog, Contract, Payment } from "@/lib/types";
import { addPayment, deleteBooking, deletePayment, verifyPayment } from "../actions";
import { PaymentForm } from "./payment-form";
import { SendContractButton } from "./send-contract";
import { PortalLinkButton } from "./portal-link";
import { googleConfigured } from "@/lib/google";
import { Flash } from "@/components/flash";

export async function generateMetadata({ params }: PageProps<"/bookings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await requireAdmin();
  const { data } = await supabase.from("bookings").select("title, ref").eq("id", id).maybeSingle();
  return { title: data?.title ?? data?.ref ?? "Booking" };
}

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await requireAdmin();
  const b = await getBooking(supabase, id);
  if (!b) notFound();

  const [{ data: payments }, { data: activity }, { data: contracts }, { data: gi }] = await Promise.all([
    supabase.from("payments").select("*").eq("booking_id", id).order("paid_on", { ascending: false }),
    supabase.from("activity_log").select("*").eq("entity_type", "booking").eq("entity_id", id).order("at", { ascending: false }).limit(30),
    supabase.from("contracts").select("id, title, status, created_at, expires_at, viewed_at, signed_at, signer_name").eq("booking_id", id).order("created_at", { ascending: false }),
    supabase.from("google_integrations").select("email").eq("id", 1).maybeSingle(),
  ]);
  const contractList = (contracts ?? []) as Contract[];
  const openContract = contractList.find((c) => c.status === "sent");
  const signedContract = contractList.find((c) => c.status === "signed");
  const pays = (payments ?? []) as Payment[];
  const depositPaid = pays.some((p) => p.kind === "deposit" && p.verified_at);

  return (
    <div className="mx-auto max-w-5xl">
      <Flash created={!!sp.created} saved={!!sp.saved} />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="tabular text-xs font-semibold tracking-wider text-muted-foreground">{b.ref}</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{b.title ?? b.client?.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusBadge status={b.status} />
            <EventTypeTag type={b.event_type} />
            <PaymentTag status={b.fin.payment_status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href={`/bookings/${b.id}/edit`}><Pencil /> Edit</Link></Button>
          <ConfirmButton variant="ghost" className="text-destructive" action={deleteBooking.bind(null, b.id)}
            title="Delete this booking?" description="This permanently removes the booking and its payments. To keep it in your records, move it to Cancelled instead.">
            Delete
          </ConfirmButton>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Event">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item label="Date">{fmtDate(b.event_date, "EEEE, MMMM d, yyyy")}</Item>
              <Item label="Time" icon={<Clock />}>{fmtTimeRange(b.start_time, b.end_time) || "-"}</Item>
              <Item label="Venue" icon={<MapPin />}>{b.venue ?? "-"}{b.venue_address && <span className="block text-muted-foreground">{b.venue_address}</span>}</Item>
              <Item label="Package">{b.package?.name ?? "Custom"}</Item>
              <Item label="Coordinator">{b.coordinator ?? "-"}</Item>
              <Item label="Guests" icon={<Users />}>{b.guest_count ?? "-"}</Item>
              {b.status === "on_hold" && b.hold_expires_at && <Item label="Hold until">{fmtStamp(b.hold_expires_at, "MMM d, yyyy")}</Item>}
              {b.status === "cancelled" && <Item label="Cancelled because">{b.cancelled_reason || "-"}</Item>}
            </dl>
            {b.notes && <p className="mt-4 rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{b.notes}</p>}
          </Panel>

          <Panel title="Payments">
            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <Money label="Rate" value={b.rate} />
              <Money label="Paid" value={b.fin.paid} />
              <Money label="Balance" value={b.fin.balance} strong={b.fin.balance > 0} />
            </div>
            {pays.length > 0 ? (
              <ul className="divide-y rounded-lg border">
                {pays.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{KIND_LABEL[p.kind]} · <span className="tabular">{php(p.amount)}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {METHOD_LABEL[p.method]} · {fmtDate(p.paid_on, "MMM d, yyyy")}{p.reference && <> · Ref {p.reference}</>}
                        {p.submitted_by === "client" && <> · uploaded by client</>}
                      </p>
                      {p.proof_path && (
                        <a href={`/payments/${p.id}/proof`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-brand-deep hover:underline dark:text-brand">View proof</a>
                      )}
                    </div>
                    {p.verified_at ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CircleCheck className="size-4" /> Verified</span>
                    ) : (
                      <form action={verifyPayment.bind(null, p.id)}>
                        <Button size="sm" className="font-semibold">Verify</Button>
                      </form>
                    )}
                    <ConfirmButton size="sm" variant="ghost" action={deletePayment.bind(null, p.id)} title="Remove this payment?" confirmLabel="Remove">
                      Remove
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No payments yet. Deposit due: <span className="tabular font-semibold text-foreground">{php(b.deposit_amount)}</span></p>
            )}
            <details className="group mt-4 rounded-lg border p-3" open={pays.length === 0}>
              <summary className="cursor-pointer text-sm font-semibold">Record a payment</summary>
              <div className="mt-3">
                <PaymentForm
                  action={addPayment.bind(null, b.id)}
                  suggestedKind={depositPaid ? "balance" : "deposit"}
                  suggestedAmount={depositPaid ? b.fin.balance : Math.min(b.deposit_amount, b.fin.balance)}
                  today={todayISO()}
                />
              </div>
            </details>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Client">
            {b.client && (
              <>
                <Link href={`/clients/${b.client.id}`} className="font-semibold hover:underline">
                  {b.client.full_name}{b.client.partner_name && ` & ${b.client.partner_name}`}
                </Link>
                <div className="mt-3 space-y-2 text-sm">
                  {b.client.phone && <a href={`tel:${b.client.phone}`} className="flex items-center gap-2 hover:underline"><Phone className="size-4 text-muted-foreground" />{b.client.phone}</a>}
                  {b.client.email && <a href={`mailto:${b.client.email}`} className="flex items-center gap-2 break-all hover:underline"><Mail className="size-4 shrink-0 text-muted-foreground" />{b.client.email}</a>}
                </div>
              </>
            )}
          </Panel>

          <Panel title="Contract">
            {contractList.length === 0 && <p className="mb-3 text-sm text-muted-foreground">No contract yet.</p>}
            <ul className="mb-3 space-y-2">
              {contractList.slice(0, 4).map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className={c.status === "void" ? "text-muted-foreground line-through" : "font-semibold"}>
                      {c.status === "signed" ? `Signed by ${c.signer_name}` : c.status === "void" ? "Replaced" : c.viewed_at ? "Opened, not signed" : "Sent, not opened"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.status === "signed" ? fmtStamp(c.signed_at!) : `Sent ${fmtStamp(c.created_at, "MMM d")}${c.status === "sent" ? ` · expires ${fmtStamp(c.expires_at, "MMM d")}` : ""}`}
                    </p>
                  </div>
                  <a href={`/contracts/${c.id}/pdf`} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-brand-deep hover:underline dark:text-brand">PDF</a>
                </li>
              ))}
            </ul>
            {!signedContract && b.status !== "cancelled" && (
              <SendContractButton bookingId={b.id} label={openContract ? "Resend new link" : "Send contract"} />
            )}
            {!b.client?.email && !signedContract && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">No client email on file, so the link will only appear in the Outbox.</p>}
          </Panel>

          <Panel title="Client page">
            <p className="mb-3 text-sm text-muted-foreground">Their private page: booking details, balance, payment upload and signed contract. Share it on Messenger or SMS.</p>
            <PortalLinkButton bookingId={b.id} />
          </Panel>

          <Panel title="Google Calendar">
            <p className="text-sm">
              {!googleConfigured() ? "Not set up on this server." : !gi ? <>Not connected. <Link href="/settings#google" className="font-semibold underline">Connect</Link></>
                : b.google_event_id ? <>On your calendar{b.google_synced_at && <span className="text-muted-foreground"> · synced {fmtStamp(b.google_synced_at, "MMM d, h:mm a")}</span>}</>
                : "Not on the calendar yet."}
            </p>
          </Panel>

          <Panel title="Activity">
            <ol className="space-y-3">
              {((activity ?? []) as ActivityLog[]).map((a) => (
                <li key={a.id} className="border-l-2 border-brand/40 pl-3 text-sm">
                  <p>{a.summary ?? a.action}</p>
                  <p className="text-xs text-muted-foreground">{fmtStamp(a.at)} · {a.actor}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="mb-4 text-sm font-bold tracking-wide text-brand-deep uppercase dark:text-brand">{title}</h2>
      {children}
    </section>
  );
}

function Item({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 flex gap-1.5 text-sm font-medium [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground">
        {icon}<span>{children}</span>
      </dd>
    </div>
  );
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${strong ? "bg-brand-soft text-brand-ink" : "bg-muted"}`}>
      <p className="text-[11px] font-semibold tracking-wide uppercase opacity-70">{label}</p>
      <p className="tabular font-bold">{php(value)}</p>
    </div>
  );
}
