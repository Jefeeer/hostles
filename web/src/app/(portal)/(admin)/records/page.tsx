import Link from "next/link";
import type { Metadata } from "next";
import { format } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Download, Table2 } from "lucide-react";
import { Delta, Stat } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EVENT_LABEL, EVENT_STYLE } from "@/lib/constants";
import { getBooking, getMonthSummary, getSheetColumns, requireAdmin } from "@/lib/data";
import { RouteDrawer } from "@/components/route-drawer";
import { BookingQuickView } from "../bookings/[id]/quick-view";
import { fmtDate, php, todayISO } from "@/lib/format";
import { SyncSheetButton } from "./sync-sheet";
import { loadMonth, parseRecordsQuery, recordsHref } from "@/lib/records";
import type { EventType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RecordsFilters } from "./filters";
import { MonthCalendar } from "./month-calendar";
import { SheetTable } from "./sheet-table";

export const metadata: Metadata = { title: "Monthly records" };

export default async function RecordsPage({ searchParams }: PageProps<"/records">) {
  const sp = await searchParams;
  const rq = parseRecordsQuery(sp);
  const supabase = await requireAdmin();
  const [rows, summary, columns, { data: google }] = await Promise.all([
    loadMonth(supabase, rq),
    getMonthSummary(supabase, rq.y, rq.m),
    getSheetColumns(supabase),
    supabase.from("google_integrations").select("id").eq("id", 1).maybeSingle(),
  ]);

  const here = recordsHref(rq);
  const openHref = `${here}${here.endsWith("?") ? "" : "&"}booking=`;
  const openId = typeof sp.booking === "string" ? sp.booking : null;
  const open = openId ? await getBooking(supabase, openId) : null;

  const label = format(new Date(rq.y, rq.m - 1, 1), "MMMM yyyy");
  const prev = rq.m === 1 ? { y: rq.y - 1, m: 12 } : { y: rq.y, m: rq.m - 1 };
  const next = rq.m === 12 ? { y: rq.y + 1, m: 1 } : { y: rq.y, m: rq.m + 1 };
  const exportQs = new URLSearchParams(Object.entries(rq).filter(([k, v]) => v !== undefined && k !== "view").map(([k, v]) => [k, String(v)]));
  const c = summary.current;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Month" className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-lg" aria-label="Previous month"><Link href={recordsHref(rq, prev)}><ChevronLeft /></Link></Button>
          <h1 className="min-w-44 text-center text-2xl font-bold tracking-tight sm:text-3xl">{label}</h1>
          <Button asChild variant="ghost" size="icon-lg" aria-label="Next month"><Link href={recordsHref(rq, next)}><ChevronRight /></Link></Button>
          <Button asChild variant="outline" size="sm" className="ml-2"><Link href={recordsHref({ view: rq.view })}>Today</Link></Button>
        </nav>
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label="Layout" className="inline-flex rounded-lg bg-muted p-1">
            {([["calendar", CalendarDays, "Calendar"], ["table", Table2, "Sheet"]] as const).map(([v, Icon, text]) => (
              <Link key={v} role="tab" aria-selected={rq.view === v} href={recordsHref(rq, { view: v })} scroll={false}
                className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium", rq.view === v ? "bg-background shadow-xs" : "text-muted-foreground")}>
                <Icon className="size-4" /> {text}
              </Link>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Download /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild><a href={`/records/export?${exportQs}&format=xlsx`}>Excel (.xlsx)</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={`/records/export?${exportQs}&format=csv`}>CSV</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={`/records/export?${exportQs}&format=pdf`}>PDF</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {google && <SyncSheetButton y={rq.y} m={rq.m} />}
        </div>
      </div>

      <section aria-label="Month summary" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bookings" value={c.bookings}
          sub={<><Delta cur={c.bookings} prev={summary.prev.bookings} label="vs last month" /><br /><Delta cur={c.bookings} prev={summary.last_year.bookings} label={`vs ${rq.y - 1}`} /></>} />
        <Stat label="Expected" value={php(c.expected)}
          sub={<><Delta cur={c.expected} prev={summary.prev.expected} label="vs last month" /><br /><Delta cur={c.expected} prev={summary.last_year.expected} label={`vs ${rq.y - 1}`} /></>} />
        <Stat label="Collected" value={php(c.collected)}
          sub={<span className="text-xs text-muted-foreground">{c.expected ? Math.round((c.collected / c.expected) * 100) : 0}% of expected</span>} />
        <Stat label="Outstanding" value={php(c.outstanding)} accent={c.outstanding > 0}
          sub={c.cancelled > 0 ? <span className="text-xs text-muted-foreground">{c.cancelled} cancelled (not counted)</span> : undefined} />
      </section>

      <div className="mb-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        {summary.busiest.filter((d) => d.count > 1).length > 0 && (
          <p><span className="font-semibold">Busiest:</span>{" "}
            {summary.busiest.filter((d) => d.count > 1).map((d) => `${fmtDate(d.date, "MMM d")} (${d.count})`).join(", ")}
          </p>
        )}
        {Object.keys(summary.by_type).length > 0 && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold">By type:</span>
            {(Object.entries(summary.by_type) as [EventType, number][]).map(([t, n]) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", EVENT_STYLE[t].dot)} />{EVENT_LABEL[t]} {n}
              </span>
            ))}
          </p>
        )}
      </div>

      <div className="mb-4"><RecordsFilters /></div>

      {rq.view === "calendar" ? (
        <MonthCalendar year={rq.y} month={rq.m} rows={rows} today={todayISO()} openHref={openHref} />
      ) : (
        <SheetTable rows={rows} columns={columns} openHref={openHref} />
      )}

      {open && (
        <RouteDrawer title={open.title ?? open.client?.full_name ?? open.ref} closeHref={here}>
          <BookingQuickView supabase={supabase} b={open} />
        </RouteDrawer>
      )}
    </>
  );
}
