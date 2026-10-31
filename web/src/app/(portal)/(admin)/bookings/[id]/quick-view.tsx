import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Clock, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { EventTypeTag, PaymentTag, StatusBadge } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { KIND_LABEL, METHOD_LABEL } from "@/lib/constants";
import { fmtDate, fmtTimeRange, php } from "@/lib/format";
import type { BookingRow, Payment } from "@/lib/types";

/** Compact booking summary for the calendar drawer; the full page has everything else. */
export async function BookingQuickView({ supabase, b }: { supabase: SupabaseClient; b: BookingRow }) {
  const { data } = await supabase.from("payments").select("*").eq("booking_id", b.id).order("paid_on", { ascending: false });
  const payments = (data ?? []) as Payment[];
  const client = [b.client?.full_name, b.client?.partner_name].filter(Boolean).join(" & ");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={b.status} />
        <EventTypeTag type={b.event_type} />
        <span className="text-xs text-muted-foreground">{b.ref}</span>
      </div>

      <div className="space-y-1.5 text-sm">
        <p className="font-semibold">{fmtDate(b.event_date, "EEEE, MMMM d, yyyy")}</p>
        {b.start_time && <p className="flex items-center gap-2"><Clock className="size-4 text-muted-foreground" />{fmtTimeRange(b.start_time, b.end_time)}</p>}
        {b.venue && <p className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" />{b.venue}</p>}
        {b.package && <p className="text-muted-foreground">Package: {b.package.name}</p>}
      </div>

      {b.client && (
        <div className="rounded-xl border p-3 text-sm">
          <Link href={`/clients/${b.client.id}`} className="font-semibold hover:underline">{client}</Link>
          {b.client.phone && <p className="mt-1 flex items-center gap-2"><Phone className="size-3.5 text-muted-foreground" /><a href={`tel:${b.client.phone}`} className="hover:underline">{b.client.phone}</a></p>}
          {b.client.email && <p className="mt-1 flex items-center gap-2"><Mail className="size-3.5 text-muted-foreground" /><a href={`mailto:${b.client.email}`} className="truncate hover:underline">{b.client.email}</a></p>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[["Rate", b.rate], ["Paid", b.fin.paid], ["Balance", b.fin.balance]].map(([label, v]) => (
          <div key={label} className="rounded-xl bg-muted/60 p-2.5">
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
            <p className="tabular font-bold">{php(Number(v))}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-center"><PaymentTag status={b.fin.payment_status} /></p>

      {payments.length > 0 && (
        <ul className="divide-y rounded-xl border text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 p-2.5">
              <span>{KIND_LABEL[p.kind]} · {METHOD_LABEL[p.method]} · {fmtDate(p.paid_on, "MMM d")}</span>
              <span className="tabular font-semibold">{php(p.amount)}{!p.verified_at && <span className="ml-1 text-xs font-normal text-amber-700 dark:text-amber-300">unverified</span>}</span>
            </li>
          ))}
        </ul>
      )}

      {b.notes && <p className="rounded-xl bg-muted/60 p-3 text-sm whitespace-pre-wrap">{b.notes}</p>}

      <div className="flex gap-2">
        <Button asChild className="flex-1 font-semibold"><Link href={`/bookings/${b.id}`}>Open booking</Link></Button>
        <Button asChild variant="outline"><Link href={`/bookings/${b.id}/edit`}><Pencil /> Edit</Link></Button>
      </div>
    </div>
  );
}
