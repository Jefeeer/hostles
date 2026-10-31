"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/constants";
import { php } from "@/lib/format";
import { BOOKING_STATUSES, EVENT_TYPES, type Booking, type Client, type EventType, type Package } from "@/lib/types";
import { cn } from "@/lib/utils";
import { checkBookingConflicts, type FormState } from "./actions";
import type { ConflictReport } from "@/lib/conflicts";

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  clients: Pick<Client, "id" | "full_name" | "partner_name" | "phone">[];
  packages: Package[];
  booking?: Booking;
  defaultDate?: string;
  initialClientId?: string;
  submitLabel: string;
  /** Default deposit % (Settings → Business rules), used to suggest a deposit. */
  depositPercent: number;
};

const nativeSelect =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function BookingForm({ action, clients, packages, booking, defaultDate, initialClientId, submitLabel, depositPercent }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const [eventType, setEventType] = useState<EventType>(booking?.event_type ?? "wedding");
  const [packageId, setPackageId] = useState(booking?.package_id ?? "");
  const [rate, setRate] = useState(String(booking?.rate ?? ""));
  const [deposit, setDeposit] = useState(String(booking?.deposit_amount ?? ""));
  const formRef = useRef<HTMLFormElement>(null);
  const [watch, setWatch] = useState(0);

  const visiblePackages = packages.filter((p) => p.is_active && (!p.event_type || p.event_type === eventType));

  function pickPackage(id: string) {
    setPackageId(id);
    const p = packages.find((x) => x.id === id);
    if (p) {
      setRate(String(p.rate));
      setDeposit(String(Math.round((p.rate * depositPercent) / 100 / 100) * 100));
    }
  }

  return (
    <form ref={formRef} action={formAction} onChange={() => setWatch((w) => w + 1)} className="space-y-8">
      {state?.error && <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{state.error}</p>}
      {state?.conflicts && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <p className="font-semibold text-destructive">Possible double booking</p>
          <ul className="mt-1 list-disc pl-5">{state.conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
          <label className="mt-2 flex items-center gap-2 font-medium">
            <input type="checkbox" name="allow_conflict" className="size-4 accent-[var(--brand)]" /> Book anyway, then save again
          </label>
        </div>
      )}

      <Fieldset legend="Client">
        <ClientPicker clients={clients} initialId={booking?.client_id ?? initialClientId} error={err("client_id")} lockToExisting={!!booking} />
      </Fieldset>

      <Fieldset legend="Event">
        <Field label="Event type" htmlFor="event_type">
          <select id="event_type" name="event_type" className={nativeSelect} value={eventType} onChange={(e) => setEventType(e.target.value as EventType)}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Title" htmlFor="title" hint="e.g. Paolo & Bea Wedding" className="sm:col-span-2">
          <Input id="title" name="title" defaultValue={booking?.title ?? ""} className="h-10" />
        </Field>
        <Field label="Date" htmlFor="event_date" error={err("event_date")}>
          <Input id="event_date" name="event_date" type="date" required defaultValue={booking?.event_date ?? defaultDate} className="h-10" />
        </Field>
        <Field label="Start" htmlFor="start_time" error={err("start_time")}>
          <Input id="start_time" name="start_time" type="time" defaultValue={booking?.start_time?.slice(0, 5) ?? ""} className="h-10" />
        </Field>
        <Field label="End" htmlFor="end_time" error={err("end_time")}>
          <Input id="end_time" name="end_time" type="time" defaultValue={booking?.end_time?.slice(0, 5) ?? ""} className="h-10" />
        </Field>
        <Field label="Venue" htmlFor="venue" className="sm:col-span-2">
          <Input id="venue" name="venue" defaultValue={booking?.venue ?? ""} placeholder="e.g. Hillcreek Gardens, Tagaytay" className="h-10" />
        </Field>
        <Field label="Guests" htmlFor="guest_count" error={err("guest_count")}>
          <Input id="guest_count" name="guest_count" type="number" min={0} inputMode="numeric" defaultValue={booking?.guest_count ?? ""} className="h-10" />
        </Field>
        <Field label="Venue address" htmlFor="venue_address" className="sm:col-span-2">
          <Input id="venue_address" name="venue_address" defaultValue={booking?.venue_address ?? ""} className="h-10" />
        </Field>
        <Field label="Coordinator" htmlFor="coordinator">
          <Input id="coordinator" name="coordinator" defaultValue={booking?.coordinator ?? ""} className="h-10" />
        </Field>
        <ConflictPanel formRef={formRef} watch={watch} bookingId={booking?.id} />
      </Fieldset>

      <Fieldset legend="Package & rate">
        <Field label="Package" htmlFor="package_id" className="sm:col-span-3">
          <select id="package_id" name="package_id" className={nativeSelect} value={packageId} onChange={(e) => pickPackage(e.target.value)}>
            <option value="">No package / custom</option>
            {visiblePackages.map((p) => <option key={p.id} value={p.id}>{p.name} · {php(p.rate)}</option>)}
          </select>
        </Field>
        <Field label="Rate (₱)" htmlFor="rate" error={err("rate")}>
          <Input id="rate" name="rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="tabular h-10" />
        </Field>
        <Field label="Deposit (₱)" htmlFor="deposit_amount" error={err("deposit_amount")}>
          <Input id="deposit_amount" name="deposit_amount" inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} className="tabular h-10" />
        </Field>
        <Field label="Balance">
          <p className="tabular flex h-10 items-center text-sm font-semibold">
            {php(Math.max(Number(rate.replace(/[₱,]/g, "") || 0) - Number(deposit.replace(/[₱,]/g, "") || 0), 0))} after deposit
          </p>
        </Field>
      </Fieldset>

      <Fieldset legend="Status">
        <Field label="Pipeline status" htmlFor="status">
          <select id="status" name="status" className={nativeSelect} defaultValue={booking?.status ?? "inquiry"}>
            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field label="Hold until" htmlFor="hold_expires_at" hint="For On Hold bookings">
          <Input id="hold_expires_at" name="hold_expires_at" type="date" defaultValue={booking?.hold_expires_at?.slice(0, 10) ?? ""} className="h-10" />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-3">
          <Textarea id="notes" name="notes" rows={4} defaultValue={booking?.notes ?? ""} />
        </Field>
      </Fieldset>

      <div className="sticky bottom-20 z-10 flex justify-end gap-2 rounded-xl border bg-background/95 p-3 backdrop-blur lg:bottom-4">
        <Button type="button" variant="outline" size="lg" onClick={() => history.back()}>Back</Button>
        <Button type="submit" size="lg" disabled={pending} className="min-w-32 font-semibold">{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}

function ClientPicker({ clients, initialId, error, lockToExisting }: {
  clients: Props["clients"]; initialId?: string; error?: string; lockToExisting: boolean;
}) {
  const [mode, setMode] = useState<"existing" | "new">(initialId || clients.length ? "existing" : "new");
  const [selected, setSelected] = useState(initialId ?? "");
  const [q, setQ] = useState(() => clients.find((c) => c.id === initialId)?.full_name ?? "");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients.filter((c) => !s || c.full_name.toLowerCase().includes(s) || c.partner_name?.toLowerCase().includes(s)).slice(0, 8);
  }, [clients, q]);

  return (
    <div className="space-y-3 sm:col-span-3">
      {!lockToExisting && (
        <div role="radiogroup" aria-label="Client" className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {(["existing", "new"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={cn("rounded-md px-3 py-1.5 font-medium", mode === m ? "bg-background shadow-xs" : "text-muted-foreground")}>
              {m === "existing" ? "Existing client" : "New client"}
            </button>
          ))}
        </div>
      )}

      {mode === "existing" ? (
        <div className="relative max-w-lg">
          <input type="hidden" name="client_id" value={selected} />
          <Label htmlFor="client_search" className="mb-1.5">Search client</Label>
          <Input
            id="client_search" value={q} autoComplete="off" className="h-10" placeholder="Type a name…"
            role="combobox" aria-expanded={open} aria-controls="client_list"
            onChange={(e) => { setQ(e.target.value); setSelected(""); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && matches.length > 0 && (
            <ul id="client_list" role="listbox" className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
              {matches.map((c) => (
                <li key={c.id} role="option" aria-selected={selected === c.id}>
                  <button type="button" className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setSelected(c.id); setQ(c.full_name); setOpen(false); }}>
                    <span className="truncate">{c.full_name}{c.partner_name && <span className="text-muted-foreground"> & {c.partner_name}</span>}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client name" htmlFor="new_client_name" error={error}>
            <Input id="new_client_name" name="new_client_name" required className="h-10" />
          </Field>
          <Field label="Partner (for couples)" htmlFor="new_client_partner">
            <Input id="new_client_partner" name="new_client_partner" className="h-10" />
          </Field>
          <Field label="Mobile" htmlFor="new_client_phone">
            <Input id="new_client_phone" name="new_client_phone" type="tel" inputMode="tel" placeholder="09XX XXX XXXX" className="h-10" />
          </Field>
          <Field label="Email" htmlFor="new_client_email">
            <Input id="new_client_email" name="new_client_email" type="email" className="h-10" />
          </Field>
        </div>
      )}
    </div>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border bg-card p-4 sm:p-6">
      <legend className="px-1 text-sm font-bold tracking-wide text-brand-deep uppercase dark:text-brand">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Field({ label, htmlFor, hint, error, className, children }: {
  label: string; htmlFor?: string; hint?: string; error?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Live double-booking check (database + Google Calendar) as the date/time changes. */
function ConflictPanel({ formRef, watch, bookingId }: { formRef: React.RefObject<HTMLFormElement | null>; watch: number; bookingId?: string }) {
  const [report, setReport] = useState<ConflictReport | null>(null);
  const [key, setKey] = useState("");

  useEffect(() => {
    const fd = formRef.current ? new FormData(formRef.current) : null;
    if (!fd) return;
    const input = {
      event_date: String(fd.get("event_date") ?? ""),
      start_time: String(fd.get("start_time") ?? ""),
      end_time: String(fd.get("end_time") ?? ""),
      event_type: String(fd.get("event_type") ?? "") as EventType,
      id: bookingId,
    };
    const k = JSON.stringify(input);
    if (k === key) return;
    const t = setTimeout(async () => {
      setKey(k);
      setReport(input.event_date ? await checkBookingConflicts(input) : null);
    }, 350);
    return () => clearTimeout(t);
  }, [watch, formRef, bookingId, key]);

  if (!report) return null;
  const clear = !report.blocking.length && !report.warnings.length;
  return (
    <div aria-live="polite" className={cn("rounded-lg border px-3 py-2.5 text-sm sm:col-span-3",
      report.blocking.length ? "border-destructive/40 bg-destructive/10" : report.warnings.length ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/40" : "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40")}>
      <p className="flex items-center gap-2 font-semibold">
        {clear ? <CircleCheck className="size-4 text-emerald-600" /> : <CircleAlert className={cn("size-4", report.blocking.length ? "text-destructive" : "text-amber-600")} />}
        {clear ? "Date is free" : report.blocking.length ? "Conflicts with your rules" : "Heads up"}
        <span className="font-normal text-muted-foreground">· {report.google ? "checked bookings + Google Calendar" : "checked bookings (Google Calendar not connected)"}</span>
      </p>
      {!clear && <ul className="mt-1 list-disc pl-6">{[...report.blocking, ...report.warnings].map((w) => <li key={w}>{w}</li>)}</ul>}
    </div>
  );
}
