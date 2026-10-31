import { requireAdmin } from "@/lib/data";
import { entryFee, type Edition, type Entry } from "@/lib/events";
import type { BookingFinancials } from "@/lib/types";

/** Entry list as CSV (opens in Excel / Google Sheets). */
export async function GET(_req: Request, ctx: RouteContext<"/events/[id]/export">) {
  const { id } = await ctx.params;
  const supabase = await requireAdmin();
  const { data: e } = await supabase.from("event_editions").select("*").eq("id", id).maybeSingle<Edition>();
  if (!e) return new Response("Not found", { status: 404 });
  const { data: entries } = await supabase.from("edition_entries").select("*").eq("edition_id", id).order("created_at");
  const ents = (entries ?? []) as Entry[];
  const ids = ents.map((x) => x.booking_id).filter((b): b is string => !!b);
  const { data: fins } = ids.length ? await supabase.from("booking_financials").select("*").in("booking_id", ids) : { data: [] };
  const fin = new Map(((fins ?? []) as BookingFinancials[]).map((f) => [f.booking_id, f]));

  const perEntry = e.fee_mode === "per_entry";
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    // Also neutralise spreadsheet formulas (=, +, -, @) typed into entries.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ["#", "Name", "Contact", "Email", ...e.fields.map((f) => f.label), ...(perEntry ? ["Fee", "Paid"] : []), "Booking"];
  const lines = ents.map((x, i) => [
    i + 1, x.name, x.contact, x.email, ...e.fields.map((f) => x.data[f.key]),
    ...(perEntry ? [entryFee(e, x), x.booking_id ? (fin.get(x.booking_id)?.paid ?? 0) : x.paid] : []),
    x.booking_id ? "yes" : "",
  ].map(esc).join(","));
  const file = e.name.replace(/[^\w-]+/g, "-").toLowerCase();
  return new Response("﻿" + [header.map(esc).join(","), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}.csv"` },
  });
}
