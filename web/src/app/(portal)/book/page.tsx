import Image from "next/image";
import type { Metadata } from "next";
import { addMonths, format } from "date-fns";
import { EVENT_LABEL } from "@/lib/constants";
import { php, todayISO } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import type { Package } from "@/lib/types";
import { InquiryForm } from "./inquiry-form";

// Availability must be live, never baked in at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book Lester",
  description: "Check availability and send an inquiry to Lester, wedding host and events emcee.",
};

export default async function BookPage() {
  const supabase = await createServiceClient();
  const today = todayISO();
  const until = format(addMonths(new Date(), 24), "yyyy-MM-dd");
  const [{ data: packages }, { data: busy }] = await Promise.all([
    supabase.from("packages").select("id, name, event_type, description, inclusions, rate, hours").eq("is_public", true).eq("is_active", true).order("sort_order"),
    supabase.rpc("public_busy_dates", { p_from: today, p_to: until }),
  ]);
  const pkgs = (packages ?? []) as Package[];

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="bg-stage px-4 pt-8 pb-10 text-cream">
        <div className="mx-auto max-w-4xl">
          <Image src="/brand/lester-script.png" alt="Lester" width={150} height={101} className="h-16 w-auto" priority />
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Let&apos;s make your event unforgettable.</h1>
          <p className="mt-2 max-w-xl text-cream/75">Weddings, debuts, birthdays and corporate events across Cavite, Tagaytay and Metro Manila. Check the calendar, then send your details.</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        {pkgs.length > 0 && (
          <section aria-labelledby="packages">
            <h2 id="packages" className="mb-3 text-xl font-bold">Packages</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {pkgs.map((p) => (
                <div key={p.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold">{p.name}</h3>
                    <span className="tabular shrink-0 font-bold text-brand-deep dark:text-brand">{php(p.rate)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.event_type ? EVENT_LABEL[p.event_type] : "Any event"}{p.hours ? ` · up to ${p.hours} hours` : ""}</p>
                  {p.description && <p className="mt-2 text-sm">{p.description}</p>}
                  {p.inclusions?.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{p.inclusions.map((i) => <li key={i}>{i}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="inquire" className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 id="inquire" className="text-xl font-bold">Check a date &amp; inquire</h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">Crossed-out dates are fully booked. Lester will reply within a day.</p>
          <InquiryForm busy={(busy as string[] | null) ?? []} today={today} packages={pkgs.map((p) => ({ id: p.id, name: p.name, rate: p.rate }))} />
        </section>
      </main>
    </div>
  );
}
