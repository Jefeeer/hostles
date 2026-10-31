import Link from "next/link";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/bits";
import { requireAdmin } from "@/lib/data";
import { resendConfigured } from "@/lib/email";
import { fmtStamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Outbox" };

type Row = { id: string; created_at: string; template_key: string | null; booking_id: string | null; to_email: string; subject: string; html: string; status: string; error: string | null };

const STATUS: Record<string, string> = {
  sent: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  simulated: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  failed: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  queued: "bg-muted text-muted-foreground",
};

export default async function OutboxPage({ searchParams }: PageProps<"/outbox">) {
  const { id } = await searchParams;
  const supabase = await requireAdmin();
  const { data } = await supabase.from("email_outbox").select("*").order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as Row[];
  const open = rows.find((r) => r.id === id) ?? rows[0];

  return (
    <>
      <PageHeader title="Outbox" description={resendConfigured()
        ? "Every email the app has sent."
        : "Email isn't configured yet, so messages are kept here instead of being sent. Links inside work, e.g. open a contract email and sign as the client."} />
      {rows.length === 0 ? (
        <EmptyState>No emails yet. Move a booking to <strong>Contract Sent</strong> to generate one.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <ul className="max-h-[70vh] divide-y overflow-y-auto rounded-xl border bg-card">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/outbox?id=${r.id}`} scroll={false} className={cn("block p-3 hover:bg-muted/50", open?.id === r.id && "bg-brand-soft/50")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{r.subject}</p>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS[r.status] ?? STATUS.queued)}>{r.status}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">To {r.to_email} · {fmtStamp(r.created_at, "MMM d, h:mm a")}</p>
                </Link>
              </li>
            ))}
          </ul>
          {open && (
            <article className="overflow-hidden rounded-xl border bg-card">
              <header className="border-b p-4 text-sm">
                <p className="font-semibold">{open.subject}</p>
                <p className="text-muted-foreground">To {open.to_email} · {fmtStamp(open.created_at)}</p>
                {open.error && <p className="text-destructive">Error: {open.error}</p>}
                {open.booking_id && <Link href={`/bookings/${open.booking_id}`} className="text-brand-deep hover:underline dark:text-brand">Open booking</Link>}
              </header>
              {/* Sandboxed: rendered email HTML, links open in a new tab. */}
              <iframe title="Email preview" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={open.html.replace("<head>", '<head><base target="_blank">')} className="h-[70vh] w-full bg-[#f4ecdf]" />
            </article>
          )}
        </div>
      )}
    </>
  );
}
