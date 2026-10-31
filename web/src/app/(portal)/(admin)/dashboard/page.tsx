import Link from "next/link";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { ChevronRight, Clock, FilePen, Hourglass, Inbox, MapPin, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Delta, EmptyState, EventTypeTag, PageHeader, Stat, StatusBadge } from "@/components/bits";
import { getMonthSummary, listBookings, monthRange, requireAdmin } from "@/lib/data";
import { fmtDate, fmtStamp, fmtTimeRange, nowManila, parseDay, php, todayISO } from "@/lib/format";
import type { BookingRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await requireAdmin();
  const now = nowManila();
  const today = todayISO();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { to: monthEnd } = monthRange(year, month);
  const weekEnd = format(addDays(parseDay(today), 6), "yyyy-MM-dd");

  const [upcoming, pipeline, summary, unverified] = await Promise.all([
    listBookings(supabase, { from: today, to: monthEnd > weekEnd ? monthEnd : weekEnd, statuses: ["inquiry", "on_hold", "contract_sent", "signed", "deposit_paid", "fully_paid"] }),
    listBookings(supabase, { statuses: ["inquiry", "on_hold", "contract_sent", "signed", "deposit_paid", "fully_paid", "done"] }),
    getMonthSummary(supabase, year, month),
    supabase.from("payments").select("id, amount, kind, booking_id, bookings(title, ref)").is("verified_at", null).order("created_at"),
  ]);

  const thisWeek = upcoming.filter((b) => b.event_date <= weekEnd);
  const laterThisMonth = upcoming.filter((b) => b.event_date > weekEnd && b.event_date <= monthEnd);

  // Website/booking-page inquiries usually go straight on hold, so count holds as leads too (same as the sidebar badge).
  const inquiries = pipeline.filter((b) => b.status === "inquiry" || b.status === "on_hold");
  const holdsExpiring = pipeline
    .filter((b) => b.status === "on_hold" && b.hold_expires_at)
    .filter((b) => new Date(b.hold_expires_at!).getTime() - now.getTime() < 3 * 86_400_000)
    .sort((a, b) => a.hold_expires_at!.localeCompare(b.hold_expires_at!));
  const awaitingSignature = pipeline.filter((b) => b.status === "contract_sent");
  // Confirmed (or finished) events with money still owed.
  const unpaid = pipeline
    .filter((b) => ["signed", "deposit_paid", "fully_paid", "done"].includes(b.status) && b.fin.balance > 0)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const unpaidTotal = unpaid.reduce((s, b) => s + b.fin.balance, 0);

  const c = summary.current;

  return (
    <>
      <PageHeader
        title={<>Magandang {now.getHours() < 12 ? "umaga" : now.getHours() < 18 ? "hapon" : "gabi"}, Lester</>}
        description={format(now, "EEEE, MMMM d, yyyy")}
      />

      <section aria-label={`${format(now, "MMMM")} at a glance`} className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Bookings · ${format(now, "MMM")}`} value={c.bookings} sub={<Delta cur={c.bookings} prev={summary.prev.bookings} label="vs last month" />} />
        <Stat label="Expected" value={php(c.expected)} sub={<Delta cur={c.expected} prev={summary.last_year.expected} label="vs last year" />} />
        <Stat label="Collected" value={php(c.collected)} sub={<span className="text-xs text-muted-foreground">{c.expected ? Math.round((c.collected / c.expected) * 100) : 0}% of expected</span>} />
        <Stat label="Outstanding" value={php(c.outstanding)} accent={c.outstanding > 0} sub={<span className="text-xs text-muted-foreground">for {format(now, "MMMM")} events</span>} />
      </section>

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <Section title="This week" href={`/records?y=${year}&m=${month}`}>
            {thisWeek.length ? <EventList rows={thisWeek} today={today} /> : <EmptyState>No events in the next 7 days.</EmptyState>}
          </Section>
          <Section title={`Later in ${format(now, "MMMM")}`} href={`/records?y=${year}&m=${month}`}>
            {laterThisMonth.length ? <EventList rows={laterThisMonth} today={today} /> : <EmptyState>Nothing else booked this month yet.</EmptyState>}
          </Section>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold">Needs attention</h2>
          <AttentionCard icon={<Inbox />} title="New leads" count={inquiries.length} href="/bookings">
            {inquiries.slice(0, 4).map((b) => (
              <MiniRow key={b.id} b={b} right={fmtDate(b.event_date, "MMM d")} />
            ))}
          </AttentionCard>
          <AttentionCard icon={<Hourglass />} title="Holds expiring (3 days)" count={holdsExpiring.length} href="/bookings" urgent>
            {holdsExpiring.slice(0, 4).map((b) => (
              <MiniRow key={b.id} b={b} right={new Date(b.hold_expires_at!) < now ? "Expired" : `until ${fmtStamp(b.hold_expires_at!, "MMM d")}`} />
            ))}
          </AttentionCard>
          <AttentionCard icon={<FilePen />} title="Awaiting signature" count={awaitingSignature.length} href="/bookings">
            {awaitingSignature.slice(0, 4).map((b) => (
              <MiniRow key={b.id} b={b} right={`sent ${fmtStamp(b.status_changed_at, "MMM d")}`} />
            ))}
          </AttentionCard>
          <AttentionCard icon={<Wallet />} title={`Unpaid balances · ${php(unpaidTotal)}`} count={unpaid.length} href="/records?pay=partial">
            {unpaid.slice(0, 5).map((b) => (
              <MiniRow key={b.id} b={b} right={php(b.fin.balance)} />
            ))}
          </AttentionCard>
          {(unverified.data?.length ?? 0) > 0 && (
            <AttentionCard icon={<Clock />} title="Payments to verify" count={unverified.data!.length} urgent>
              {unverified.data!.slice(0, 5).map((p) => {
                const bk = p.bookings as unknown as { title: string | null; ref: string } | null;
                return (
                  <Link key={p.id} href={`/bookings/${p.booking_id}`} className="flex justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <span className="truncate">{bk?.title ?? bk?.ref}</span>
                    <span className="tabular font-semibold">{php(p.amount)}</span>
                  </Link>
                );
              })}
            </AttentionCard>
          )}
        </div>
      </div>
    </>
  );
}

function Section({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-brand-deep hover:underline dark:text-brand">Monthly records</Link>
      </div>
      {children}
    </section>
  );
}

function EventList({ rows, today }: { rows: BookingRow[]; today: string }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {rows.map((b) => {
        const days = differenceInCalendarDays(parseDay(b.event_date), parseDay(today));
        return (
          <li key={b.id}>
            <Link href={`/bookings/${b.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50">
              <div className="w-12 shrink-0 text-center">
                <p className="text-[11px] font-bold tracking-wider text-brand-deep uppercase dark:text-brand">{fmtDate(b.event_date, "EEE")}</p>
                <p className="tabular text-2xl leading-none font-bold">{fmtDate(b.event_date, "d")}</p>
                <p className="text-[11px] text-muted-foreground">{fmtDate(b.event_date, "MMM")}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{b.title ?? b.client?.full_name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <EventTypeTag type={b.event_type} />
                  {b.start_time && <span>{fmtTimeRange(b.start_time, b.end_time)}</span>}
                  {b.venue && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3.5 shrink-0" /><span className="truncate">{b.venue}</span></span>}
                </p>
              </div>
              <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                <StatusBadge status={b.status} />
                <span className="text-xs text-muted-foreground">{days === 0 ? "Today" : days === 1 ? "Tomorrow" : `in ${days} days`}</span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AttentionCard({ icon, title, count, href, urgent, children }: {
  icon: ReactNode; title: string; count: number; href?: string; urgent?: boolean; children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", urgent && count > 0 && "border-brand/50")}>
      <div className="flex items-center gap-2.5">
        <span className={cn("grid size-8 place-items-center rounded-lg bg-muted [&_svg]:size-4", urgent && count > 0 && "bg-brand-soft text-brand-ink")}>{icon}</span>
        <h3 className="flex-1 text-sm font-semibold">{title}</h3>
        <span className="tabular text-lg font-bold">{count}</span>
      </div>
      {count > 0 && <div className="mt-3 space-y-0.5">{children}</div>}
      {href && count > 4 && <Link href={href} className="mt-2 block text-xs font-medium text-brand-deep hover:underline dark:text-brand">View all</Link>}
    </div>
  );
}

function MiniRow({ b, right }: { b: BookingRow; right: string }) {
  return (
    <Link href={`/bookings/${b.id}`} className="flex justify-between gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
      <span className="truncate">{b.title ?? b.client?.full_name}</span>
      <span className="tabular shrink-0 text-muted-foreground">{right}</span>
    </Link>
  );
}
