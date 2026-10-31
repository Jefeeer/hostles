import Link from "next/link";
import { StatusBadge } from "@/components/bits";
import { php } from "@/lib/format";
import { activeColumns } from "@/lib/sheet";
import type { BookingRow, SheetColumn } from "@/lib/types";
import { cn } from "@/lib/utils";

/** His monthly sheet, rebuilt from the database. Columns follow Settings → Monthly sheet columns. */
export function SheetTable({ rows, columns, openHref }: { rows: BookingRow[]; columns: SheetColumn[]; openHref: string }) {
  const cols = activeColumns(columns);
  const totals = (key: string) => rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(cols.find((c) => c.key === key)!.field.value(r) || 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="sticky top-0 bg-muted/60 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col" className={cn("px-3 py-2.5 whitespace-nowrap", c.field.money && "text-right")}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((b) => (
            <tr key={b.id} className={cn("hover:bg-muted/40", b.status === "cancelled" && "text-muted-foreground line-through decoration-1")}>
              {cols.map((c) => {
                const v = c.field.value(b);
                return (
                  <td key={c.key} className={cn("px-3 py-2 align-top", c.field.money && "tabular text-right whitespace-nowrap", c.key === "notes" && "max-w-xs truncate")}>
                    {c.key === "client" ? (
                      <Link href={`${openHref}${b.id}`} scroll={false} className="font-semibold hover:underline">{v}</Link>
                    ) : c.key === "status" ? (
                      <StatusBadge status={b.status} />
                    ) : c.field.money ? (
                      php(v)
                    ) : (
                      v
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="px-3 py-10 text-center text-muted-foreground">No bookings match.</td></tr>
          )}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="border-t-2 bg-muted/40 font-bold">
            <tr>
              {cols.map((c, i) => (
                <td key={c.key} className={cn("tabular px-3 py-2.5", c.field.money && "text-right whitespace-nowrap")}>
                  {c.field.money ? php(totals(c.key)) : i === 0 ? `${rows.filter((r) => r.status !== "cancelled").length} events` : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
