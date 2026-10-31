import "server-only";
import { listBookings, monthRange, type BookingFilters } from "./data";
import { nowManila } from "./format";
import { BOOKING_STATUSES, EVENT_TYPES, type BookingStatus, type EventType, type PaymentStatus } from "./types";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Parse ?y=2026&m=10&type=wedding&status=signed&pay=partial&q=… shared by the page and exports. */
export function parseRecordsQuery(sp: SP) {
  const now = nowManila();
  const y = Number(one(sp.y)) || now.getFullYear();
  const mRaw = Number(one(sp.m));
  const m = mRaw >= 1 && mRaw <= 12 ? mRaw : now.getMonth() + 1;
  const type = one(sp.type);
  const status = one(sp.status);
  const pay = one(sp.pay);
  const view = one(sp.view) === "table" ? "table" : "calendar";
  return {
    y,
    m,
    view: view as "calendar" | "table",
    type: EVENT_TYPES.includes(type as EventType) ? (type as EventType) : undefined,
    status: BOOKING_STATUSES.includes(status as BookingStatus) ? (status as BookingStatus) : undefined,
    pay: ["unpaid", "partial", "paid"].includes(pay ?? "") ? (pay as PaymentStatus) : undefined,
    q: one(sp.q)?.trim() || undefined,
  };
}

export type RecordsQuery = ReturnType<typeof parseRecordsQuery>;

export function recordsFilters(rq: RecordsQuery): BookingFilters {
  return {
    ...monthRange(rq.y, rq.m),
    eventTypes: rq.type ? [rq.type] : undefined,
    statuses: rq.status ? [rq.status] : undefined,
    payment: rq.pay,
    q: rq.q,
  };
}

export const loadMonth = (supabase: Parameters<typeof listBookings>[0], rq: RecordsQuery) => listBookings(supabase, recordsFilters(rq));

export function recordsHref(rq: Partial<RecordsQuery>, patch: Partial<RecordsQuery> = {}) {
  const merged = { ...rq, ...patch };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "view" && v === "calendar")) p.set(k, String(v));
  return `/records?${p}`;
}
