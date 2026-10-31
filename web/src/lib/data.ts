import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { endOfMonth, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type {
  Booking, BookingFinancials, BookingRow, BookingStatus, Client, EventType, MonthSummary,
  Package, PaymentStatus, SheetColumn,
} from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Server-side guard for every admin page/action. Returns a Supabase client bound to the admin. */
export const requireAdmin = cache(async (): Promise<Supabase> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) redirect("/login?error=forbidden");
  return supabase;
});

const BOOKING_SELECT = "*, client:clients(id, full_name, partner_name, phone, email), package:packages(id, name)";

/** Attach derived money (paid / balance / payment status) to bookings. */
async function withFinancials(supabase: Supabase, rows: Omit<BookingRow, "fin">[]): Promise<BookingRow[]> {
  if (rows.length === 0) return [];
  const fins = new Map<string, BookingFinancials>();
  // Chunk to keep the PostgREST URL short.
  for (let i = 0; i < rows.length; i += 150) {
    const ids = rows.slice(i, i + 150).map((r) => r.id);
    const { data, error } = await supabase.from("booking_financials").select("booking_id, paid, balance, payment_status").in("booking_id", ids);
    if (error) throw error;
    for (const f of data as BookingFinancials[]) fins.set(f.booking_id, { ...f, paid: Number(f.paid), balance: Number(f.balance) });
  }
  return rows.map((r) => ({
    ...r,
    rate: Number(r.rate),
    deposit_amount: Number(r.deposit_amount),
    fin: fins.get(r.id) ?? { booking_id: r.id, paid: 0, balance: Number(r.rate), payment_status: "unpaid" },
  }));
}

export type BookingFilters = {
  from?: string; // yyyy-MM-dd inclusive
  to?: string; // yyyy-MM-dd inclusive
  statuses?: BookingStatus[];
  eventTypes?: EventType[];
  payment?: PaymentStatus;
  q?: string;
  clientId?: string;
};

export async function listBookings(supabase: Supabase, f: BookingFilters = {}): Promise<BookingRow[]> {
  let query = supabase.from("bookings").select(BOOKING_SELECT).order("event_date").order("start_time", { nullsFirst: true });
  if (f.from) query = query.gte("event_date", f.from);
  if (f.to) query = query.lte("event_date", f.to);
  if (f.statuses?.length) query = query.in("status", f.statuses);
  if (f.eventTypes?.length) query = query.in("event_type", f.eventTypes);
  if (f.clientId) query = query.eq("client_id", f.clientId);
  const { data, error } = await query;
  if (error) throw error;

  let rows = await withFinancials(supabase, data as Omit<BookingRow, "fin">[]);
  if (f.payment) rows = rows.filter((r) => r.fin.payment_status === f.payment);
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter((r) =>
      [r.title, r.venue, r.client?.full_name, r.client?.partner_name, r.ref]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }
  return rows;
}

export async function getBooking(supabase: Supabase, id: string): Promise<BookingRow | null> {
  const { data, error } = await supabase.from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [row] = await withFinancials(supabase, [data as Omit<BookingRow, "fin">]);
  return row;
}

export function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  return { from: format(start, "yyyy-MM-dd"), to: format(endOfMonth(start), "yyyy-MM-dd") };
}

export async function getMonthSummary(supabase: Supabase, year: number, month: number): Promise<MonthSummary> {
  const { data, error } = await supabase.rpc("month_summary", { p_year: year, p_month: month });
  if (error) throw error;
  const s = data as MonthSummary;
  const num = (t: MonthSummary["current"]) => ({
    bookings: Number(t.bookings), cancelled: Number(t.cancelled), expected: Number(t.expected),
    collected: Number(t.collected), outstanding: Number(t.outstanding),
  });
  return { ...s, current: num(s.current), prev: num(s.prev), last_year: num(s.last_year) };
}

export async function getSetting<T>(supabase: Supabase, key: string, fallback: T): Promise<T> {
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? fallback;
}

export const getSheetColumns = (supabase: Supabase) => getSetting<SheetColumn[]>(supabase, "sheet_columns", []);

export async function listPackages(supabase: Supabase, { activeOnly = false } = {}): Promise<Package[]> {
  let q = supabase.from("packages").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Package[]).map((p) => ({ ...p, rate: Number(p.rate) }));
}

export async function listClients(supabase: Supabase, q?: string): Promise<Client[]> {
  let query = supabase.from("clients").select("*").order("full_name");
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,partner_name.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw error;
  return data as Client[];
}

export type { Booking };
