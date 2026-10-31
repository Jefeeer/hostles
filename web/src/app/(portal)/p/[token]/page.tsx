import Image from "next/image";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { format, subDays } from "date-fns";
import { CalendarDays, CircleCheck, Clock, Download, MapPin } from "lucide-react";
import { EVENT_LABEL, KIND_LABEL, METHOD_LABEL } from "@/lib/constants";
import { fmtDate, fmtTimeRange, parseDay, php } from "@/lib/format";
import { findBookingByPortalToken } from "@/lib/portal";
import { getPaymentInstructions, getRules } from "@/lib/settings";
import { createServiceClient } from "@/lib/supabase/server";
import type { Payment } from "@/lib/types";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = { title: "Your booking", robots: { index: false, follow: false } };

const STAGE: Record<string, string> = {
  inquiry: "Inquiry received", on_hold: "Date on hold", contract_sent: "Contract sent, waiting for your signature", signed: "Contract signed, deposit next",
  deposit_paid: "Date secured", fully_paid: "Fully paid. See you there!", done: "Event done. Thank you!", cancelled: "Cancelled",
};

export default async function PortalPage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const supabase = await createServiceClient();
  const b = await findBookingByPortalToken(supabase, token);

  if (!b) {
    return (
      <Shell>
        <div className="rounded-xl border bg-card p-8 text-center">
          <h1 className="text-xl font-bold">This link has expired</h1>
          <p className="mt-2 text-muted-foreground">Please use the link in the latest email from Lester, or reply to it for a new one.</p>
        </div>
      </Shell>
    );
  }

  const [rules, instructions, { data: payments }, { data: signed }] = await Promise.all([
    getRules(supabase),
    getPaymentInstructions(supabase),
    supabase.from("payments").select("id, kind, method, amount, paid_on, verified_at, submitted_by").eq("booking_id", b.id).order("created_at", { ascending: false }),
    supabase.from("contracts").select("id, signed_at").eq("booking_id", b.id).eq("status", "signed").order("signed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const pays = (payments ?? []) as Payment[];
  const pending = pays.filter((p) => !p.verified_at).reduce((s, p) => s + Number(p.amount), 0);
  const depositCovered = b.fin.paid >= b.deposit_amount;
  const balanceDue = format(subDays(parseDay(b.event_date), rules.balance_due_days_before), "MMMM d, yyyy");
  const acceptsPayments = !["cancelled", "done"].includes(b.status) && b.fin.balance > 0;
  const suggested = Math.max((depositCovered ? b.fin.balance : b.deposit_amount - b.fin.paid) - pending, 0);

  return (
    <Shell>
      <p className="text-sm font-semibold text-brand-deep dark:text-brand">{STAGE[b.status]}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{b.title ?? EVENT_LABEL[b.event_type]}</h1>
      <div className="mt-3 space-y-1.5 text-sm">
        <p className="flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" />{fmtDate(b.event_date, "EEEE, MMMM d, yyyy")}</p>
        {b.start_time && <p className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" />{fmtTimeRange(b.start_time, b.end_time)}</p>}
        {b.venue && <p className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" />{b.venue}</p>}
        <p className="text-xs text-muted-foreground">Ref {b.ref}</p>
      </div>

      <section className="mt-6 grid grid-cols-3 gap-2 text-center">
        <Money label="Total" value={b.rate} />
        <Money label="Paid" value={b.fin.paid} />
        <Money label="Balance" value={b.fin.balance} strong={b.fin.balance > 0} />
      </section>
      {pending > 0 && <p className="mt-2 text-center text-sm text-muted-foreground">{php(pending)} waiting to be verified</p>}
      {b.fin.balance > 0 && (
        <p className="mt-3 text-sm">
          {!depositCovered
            ? <>Reservation deposit: <strong className="tabular">{php(b.deposit_amount)}</strong> to secure your date.</>
            : <>Remaining balance due on or before <strong>{balanceDue}</strong>.</>}
        </p>
      )}

      {signed && (
        <a href={`/p/${token}/contract`} className="mt-6 flex items-center justify-between rounded-xl border bg-card p-4 font-semibold hover:border-brand/50">
          <span className="flex items-center gap-2"><CircleCheck className="size-5 text-emerald-600" /> Signed contract</span>
          <span className="flex items-center gap-1 text-sm text-brand-deep dark:text-brand"><Download className="size-4" /> PDF</span>
        </a>
      )}
      {b.status === "contract_sent" && <p className="mt-6 rounded-xl border bg-card p-4 text-sm">Your contract is waiting for your signature. Please use the signing link in Lester&apos;s email.</p>}

      {acceptsPayments && (
        <section className="mt-6 rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-bold">Send a payment</h2>
          {instructions && <pre className="mt-3 rounded-lg bg-muted p-3 font-sans text-sm whitespace-pre-wrap">{instructions}</pre>}
          <p className="mt-4 mb-4 text-sm text-muted-foreground">After paying, upload your screenshot here so Lester can verify it.</p>
          <UploadForm token={token} suggested={suggested} />
        </section>
      )}

      {pays.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">Payments</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {pays.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-semibold">{KIND_LABEL[p.kind]} · <span className="tabular">{php(p.amount)}</span></p>
                  <p className="text-xs text-muted-foreground">{METHOD_LABEL[p.method]} · {fmtDate(p.paid_on, "MMM d, yyyy")}</p>
                </div>
                {p.verified_at
                  ? <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Received</span>
                  : <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Verifying</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-center text-xs text-muted-foreground">Questions? Just reply to any email from Lester.</p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="bg-stage px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Image src="/brand/lester-script.png" alt="Lester" width={90} height={61} className="h-9 w-auto" priority />
          <span className="text-[10px] font-semibold tracking-[0.28em] text-cream/70">EVENTS HOST</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </div>
  );
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${strong ? "bg-brand-soft text-brand-ink" : "bg-card border"}`}>
      <p className="text-[11px] font-semibold tracking-wide uppercase opacity-70">{label}</p>
      <p className="tabular text-lg font-bold">{php(value)}</p>
    </div>
  );
}
