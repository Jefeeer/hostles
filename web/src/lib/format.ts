import { format, parseISO } from "date-fns";
import { TZDate } from "@date-fns/tz";

export const TZ = "Asia/Manila";

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const pesoExact = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

export const php = (n: number | string | null | undefined) => peso.format(Number(n ?? 0));
export const phpExact = (n: number | string | null | undefined) => pesoExact.format(Number(n ?? 0));

/** "Now" in Manila, as a TZDate so getDate()/getMonth() are Manila-local. */
export const nowManila = () => new TZDate(Date.now(), TZ);

/** Today's date in Manila as yyyy-MM-dd. */
export const todayISO = () => format(nowManila(), "yyyy-MM-dd");

/** Event dates are plain local dates (yyyy-MM-dd): parse without timezone shifting. */
export const parseDay = (d: string) => parseISO(d);

export const fmtDate = (d: string, pattern = "EEE, MMM d, yyyy") => format(parseDay(d), pattern);

/** "17:00:00" → "5:00 PM" */
export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtTimeRange(a: string | null, b: string | null) {
  if (!a) return "";
  return b ? `${fmtTime(a)} – ${fmtTime(b)}` : fmtTime(a);
}

/** A timestamptz shown in Manila time. */
export const fmtStamp = (ts: string, pattern = "MMM d, yyyy h:mm a") => format(new TZDate(ts, TZ), pattern);

export const pctChange = (cur: number, prev: number) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 100));
