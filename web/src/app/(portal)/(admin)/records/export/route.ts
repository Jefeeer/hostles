import { createElement } from "react";
import { format } from "date-fns";
import ExcelJS from "exceljs";
import { renderToBuffer } from "@react-pdf/renderer";
import { EVENT_LABEL, STATUS_LABEL } from "@/lib/constants";
import { getMonthSummary, getSheetColumns, requireAdmin } from "@/lib/data";
import { fmtStamp } from "@/lib/format";
import { MonthReport } from "@/lib/pdf/month-report";
import { loadMonth, parseRecordsQuery } from "@/lib/records";
import { activeColumns } from "@/lib/sheet";

export async function GET(req: Request) {
  const supabase = await requireAdmin();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rq = parseRecordsQuery(sp);
  const fmtParam = sp.format;

  const [rows, columns] = await Promise.all([loadMonth(supabase, rq), getSheetColumns(supabase)]);
  const cols = activeColumns(columns);
  const monthLabel = format(new Date(rq.y, rq.m - 1, 1), "MMM yyyy"); // also the Sheets tab name, e.g. "Oct 2026"
  const base = `host-lester-${rq.y}-${String(rq.m).padStart(2, "0")}`;
  const filters = [rq.type && EVENT_LABEL[rq.type], rq.status && STATUS_LABEL[rq.status], rq.pay, rq.q && `"${rq.q}"`].filter(Boolean).join(" · ");

  if (fmtParam === "csv") {
    const esc = (v: string | number) => {
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [cols.map((c) => esc(c.label)).join(","), ...rows.map((r) => cols.map((c) => esc(c.field.value(r))).join(","))];
    // BOM so Excel opens UTF-8 (₱, ñ) correctly.
    return new Response("﻿" + lines.join("\r\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
    });
  }

  if (fmtParam === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Host Lester";
    const ws = wb.addWorksheet(monthLabel, { views: [{ state: "frozen", ySplit: 2 }] });
    ws.columns = cols.map((c) => ({ key: c.key, width: c.field.width ?? 12 }));

    ws.mergeCells(1, 1, 1, cols.length);
    ws.getCell(1, 1).value = `${format(new Date(rq.y, rq.m - 1, 1), "MMMM yyyy")} · Host Lester${filters ? ` · ${filters}` : ""}`;
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FFC24700" } };

    const header = ws.addRow(cols.map((c) => c.label));
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17110C" } };

    for (const r of rows) {
      const row = ws.addRow(cols.map((c) => c.field.value(r)));
      if (r.status === "cancelled") row.font = { strike: true, color: { argb: "FF8A7F75" } };
    }
    const lastData = ws.rowCount;
    const total = ws.addRow(cols.map((c, i) => {
      if (!c.field.money) return i === 0 ? "Total" : "";
      // Non-cancelled rows only, like the app.
      return rows.reduce((sum, r) => sum + (r.status === "cancelled" ? 0 : Number(c.field.value(r) || 0)), 0);
    }));
    total.font = { bold: true };
    total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4ECDF" } };

    cols.forEach((c, i) => {
      if (c.field.money) ws.getColumn(i + 1).numFmt = '"₱"#,##0.00';
    });
    if (rows.length) ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: lastData, column: cols.length } };

    const buf = await wb.xlsx.writeBuffer();
    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
      },
    });
  }

  if (fmtParam === "pdf") {
    const summary = await getMonthSummary(supabase, rq.y, rq.m);
    const doc = createElement(MonthReport, {
      title: `${format(new Date(rq.y, rq.m - 1, 1), "MMMM yyyy")} · Monthly records`,
      subtitle: `Generated ${fmtStamp(new Date().toISOString())}${filters ? ` · Filtered: ${filters}` : ""}`,
      rows, columns, summary,
    });
    const buf = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${base}.pdf"` },
    });
  }

  return new Response("Unknown format", { status: 400 });
}
