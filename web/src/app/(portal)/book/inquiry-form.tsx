"use client";

import { useActionState, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_LABEL } from "@/lib/constants";
import { php } from "@/lib/format";
import { EVENT_TYPES } from "@/lib/types";
import { submitInquiry } from "./actions";

const sel = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base dark:bg-input/30";

export function InquiryForm({ busy, today, packages }: { busy: string[]; today: string; packages: { id: string; name: string; rate: number }[] }) {
  const [state, action, pending] = useActionState(submitInquiry, undefined);
  const [date, setDate] = useState("");
  const [loadedAt] = useState(() => Date.now());

  if (state?.ok) {
    return (
      <div role="status" className="rounded-xl bg-emerald-50 p-6 text-center text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
        <CircleCheck className="mx-auto size-10 text-emerald-600" />
        <p className="mt-3 text-lg font-bold">Thank you! Your inquiry is in.</p>
        <p className="mt-1 text-sm">{state.held ? "Your date is on hold while Lester gets back to you." : "Lester will check the date and get back to you."} A confirmation is on its way to your email.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="t" value={loadedAt} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <AvailabilityCalendar busy={new Set(busy)} today={today} value={date} onChange={setDate} />
      <input type="hidden" name="event_date" value={date} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="full_name" label="Your name" required autoComplete="name" />
        <Field id="partner_name" label="Partner's name (weddings)" />
        <Field id="email" label="Email" type="email" required autoComplete="email" />
        <Field id="phone" label="Mobile number" type="tel" required autoComplete="tel" />
        <div className="space-y-1.5">
          <Label htmlFor="event_type">Event</Label>
          <select id="event_type" name="event_type" defaultValue="wedding" className={sel}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}
          </select>
        </div>
        <Field id="start_time" label="Start time (if known)" type="time" />
        <Field id="venue" label="Venue (if known)" />
        <Field id="guest_count" label="Number of guests" type="number" min={1} />
        {packages.length > 0 && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="package_id">Package</Label>
            <select id="package_id" name="package_id" defaultValue="" className={sel}>
              <option value="">Not sure yet</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name} · {php(p.rate)}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="message">Anything else? (theme, program, special requests)</Label>
        <Textarea id="message" name="message" rows={4} className="text-base" />
      </div>

      {state?.error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="lg" disabled={pending || !date} className="h-12 w-full text-base font-semibold sm:w-auto sm:px-10">
        {pending ? "Sending…" : date ? `Send inquiry for ${format(new Date(`${date}T00:00`), "MMM d, yyyy")}` : "Pick a date above"}
      </Button>
    </form>
  );
}

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} className="h-11 text-base" {...props} />
    </div>
  );
}

function AvailabilityCalendar({ busy, today, value, onChange }: { busy: Set<string>; today: string; value: string; onChange: (d: string) => void }) {
  const first = startOfMonth(new Date(`${today}T00:00`));
  const [offset, setOffset] = useState(0);
  const month = addMonths(first, offset);
  const days = eachDayOfInterval({ start: month, end: endOfMonth(month) });

  return (
    <fieldset>
      <legend className="sr-only">Event date</legend>
      <div className="mb-2 flex items-center justify-between">
        <Button type="button" variant="ghost" size="icon" disabled={offset === 0} onClick={() => setOffset(offset - 1)} aria-label="Previous month"><ChevronLeft /></Button>
        <p className="font-semibold" aria-live="polite">{format(month, "MMMM yyyy")}</p>
        <Button type="button" variant="ghost" size="icon" disabled={offset >= 23} onClick={() => setOffset(offset + 1)} aria-label="Next month"><ChevronRight /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: getDay(month) }, (_, i) => <div key={`pad${i}`} />)}
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const full = busy.has(iso);
          const past = iso <= today;
          const selected = iso === value;
          return (
            <button key={iso} type="button" disabled={full || past} onClick={() => onChange(iso)}
              aria-pressed={selected} aria-label={`${format(d, "EEEE, MMMM d")}${full ? ", fully booked" : ""}`}
              className={`h-11 rounded-lg text-sm font-medium transition-colors ${selected ? "bg-brand font-bold text-brand-ink" : full ? "text-muted-foreground/60 line-through" : past ? "text-muted-foreground/40" : "border bg-background hover:border-brand"}`}>
              {format(d, "d")}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm">{value ? <>Selected: <strong>{format(new Date(`${value}T00:00`), "EEEE, MMMM d, yyyy")}</strong></> : "Tap a date."}</p>
    </fieldset>
  );
}
