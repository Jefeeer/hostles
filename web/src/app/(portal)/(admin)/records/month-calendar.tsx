import Link from "next/link";
import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { Plus } from "lucide-react";
import { EventTypeTag, StatusBadge } from "@/components/bits";
import { EVENT_LABEL, EVENT_STYLE } from "@/lib/constants";
import { fmtDate, fmtTime, fmtTimeRange, php } from "@/lib/format";
import { EVENT_TYPES, type BookingRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Month grid (Sun–Sat). Phones get colored dots in the grid plus an agenda list below. */
/** `openHref` + booking id = this page with the booking drawer open. */
export function MonthCalendar({ year, month, rows, today, openHref }: { year: number; month: number; rows: BookingRow[]; today: string; openHref: string }) {
  const first = startOfMonth(new Date(year, month - 1, 1));
  const days = eachDayOfInterval({ start: startOfWeek(first), end: endOfWeek(endOfMonth(first)) });
  const byDay = new Map<string, BookingRow[]>();
  for (const r of rows) byDay.set(r.event_date, [...(byDay.get(r.event_date) ?? []), r]);
  const agenda = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const inMonth = d.getMonth() === month - 1;
            const items = inMonth ? byDay.get(iso) ?? [] : [];
            const isToday = iso === today;
            return (
              <div
                key={iso}
                className={cn(
                  "group relative min-h-16 border-r border-b p-1 last:border-r-0 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/30",
                )}
              >
                {inMonth && (
                  <div className="flex items-center justify-between">
                    <a href={items.length ? `#day-${iso}` : undefined}
                      className={cn("tabular grid size-6 place-items-center rounded-full text-xs font-semibold sm:pointer-events-none",
                        isToday && "bg-brand text-primary-foreground")}>
                      {d.getDate()}
                    </a>
                    <Link href={`/bookings/new?date=${iso}`} aria-label={`New booking on ${format(d, "MMM d")}`}
                      className="hidden size-6 place-items-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted focus:opacity-100 sm:grid">
                      <Plus className="size-3.5" />
                    </Link>
                  </div>
                )}
                {/* Phones: dots */}
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {items.map((b) => (
                    <span key={b.id} className={cn("size-2 rounded-full", EVENT_STYLE[b.event_type].dot, b.status === "cancelled" && "opacity-30")} />
                  ))}
                </div>
                {/* Tablet/desktop: chips */}
                <ul className="mt-1 hidden space-y-1 sm:block">
                  {items.map((b) => (
                    <li key={b.id}>
                      <Link href={`${openHref}${b.id}`} scroll={false} title={`${b.title ?? ""} · ${b.venue ?? ""}`}
                        className={cn("block truncate rounded border-l-[3px] px-1.5 py-0.5 text-[11px] leading-tight font-medium hover:brightness-95",
                          EVENT_STYLE[b.event_type].chip, b.status === "cancelled" && "line-through opacity-50",
                          (b.status === "inquiry" || b.status === "on_hold") && "border-dashed opacity-80")}>
                        {b.start_time && <span className="tabular opacity-70">{fmtTime(b.start_time).replace(":00", "")} </span>}
                        {b.title ?? b.client?.full_name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {EVENT_TYPES.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2.5 rounded-full", EVENT_STYLE[t].dot)} /> {EVENT_LABEL[t]}
          </span>
        ))}
        <span className="text-xs text-muted-foreground">· Faded = inquiry / on hold</span>
      </div>

      {/* Agenda: the main view on phones, a quick list on desktop */}
      <div className="mt-6 sm:hidden">
        <h3 className="mb-2 text-sm font-bold">Agenda</h3>
        {agenda.length === 0 && <p className="text-sm text-muted-foreground">No bookings match.</p>}
        <ol className="space-y-4">
          {agenda.map(([iso, items]) => (
            <li key={iso} id={`day-${iso}`} className="scroll-mt-20">
              <p className="mb-1.5 text-xs font-bold tracking-wider text-brand-deep uppercase dark:text-brand">{fmtDate(iso, "EEE, MMM d")}</p>
              <ul className="divide-y rounded-xl border bg-card">
                {items.map((b) => (
                  <li key={b.id}>
                    <Link href={`${openHref}${b.id}`} scroll={false} className="block p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold leading-snug">{b.title ?? b.client?.full_name}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
                        <EventTypeTag type={b.event_type} />
                        {b.start_time && <span>{fmtTimeRange(b.start_time, b.end_time)}</span>}
                        {b.fin.balance > 0 && <span className="tabular font-medium text-foreground">{php(b.fin.balance)} due</span>}
                      </p>
                      {b.venue && <p className="mt-0.5 truncate text-sm text-muted-foreground">{b.venue}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
