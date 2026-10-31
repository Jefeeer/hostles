import "server-only";
import { format } from "date-fns";
import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "./activity";
import { getSheetColumns } from "./data";
import { googleAuth, SHEETS_SCOPE } from "./google";
import { loadMonth, parseRecordsQuery } from "./records";
import { activeColumns } from "./sheet";
import type { BookingRow, SheetColumn } from "./types";

export type SheetSyncResult =
  | { ok: true; action: "synced"; url: string; tab: string; rows: number }
  | { ok: true; action: "skipped"; reason: string }
  | { ok: false; error: string };

/** Header + one row per booking + totals (cancelled rows excluded from totals, like the app). */
export function sheetValues(rows: BookingRow[], config: SheetColumn[]): (string | number)[][] {
  const cols = activeColumns(config);
  const body = rows.map((r) => cols.map((c) => c.field.value(r)));
  const totals = cols.map((c, i) => c.field.money
    ? rows.reduce((s, r) => s + (r.status === "cancelled" ? 0 : Number(c.field.value(r) || 0)), 0)
    : i === 0 ? "Total" : "");
  return [cols.map((c) => c.label), ...body, ...(rows.length ? [totals] : [])];
}

/**
 * Mirror one month into the "Mon YYYY" tab of the app's spreadsheet (created on first sync).
 * Push-only: the tab is overwritten each time, so edit bookings in the app, not the sheet.
 * Values are written RAW, so nothing a client typed can run as a formula. Never throws.
 */
export async function syncMonthToSheet(supabase: SupabaseClient, y: number, m: number): Promise<SheetSyncResult> {
  try {
    const g = await googleAuth(supabase);
    if (!g) return { ok: true, action: "skipped", reason: "Google not connected" };
    if (g.row.scopes && !g.row.scopes.includes(SHEETS_SCOPE)) return { ok: true, action: "skipped", reason: "Reconnect Google in Settings to allow Sheets" };
    const sheets = google.sheets({ version: "v4", auth: g.auth });

    let id = g.row.sheet_id;
    if (!id) {
      const res = await sheets.spreadsheets.create({ requestBody: { properties: { title: "Host Lester · Monthly records", locale: "en_PH", timeZone: "Asia/Manila" } } });
      id = res.data.spreadsheetId!;
      await supabase.from("google_integrations").update({ sheet_id: id }).eq("id", 1);
    }

    const tab = format(new Date(y, m - 1, 1), "MMM yyyy");
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties" });
    let tabId = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
    if (tabId == null) {
      const add = await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: [{ addSheet: { properties: { title: tab, gridProperties: { frozenRowCount: 1 } } } }] } });
      tabId = add.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    }

    const [rows, columns] = await Promise.all([loadMonth(supabase, parseRecordsQuery({ y: String(y), m: String(m) })), getSheetColumns(supabase)]);
    const values = sheetValues(rows, columns);
    const range = `'${tab}'`;
    await sheets.spreadsheets.values.clear({ spreadsheetId: id, range });
    await sheets.spreadsheets.values.update({ spreadsheetId: id, range: `${range}!A1`, valueInputOption: "RAW", requestBody: { values } });
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: [
      { repeatCell: { range: { sheetId: tabId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
    ] } });

    await supabase.from("google_integrations").update({ sheet_synced_at: new Date().toISOString(), last_error: null }).eq("id", 1);
    await logActivity(supabase, { entity_type: "system", action: "sheets.synced", summary: `Google Sheet: ${tab} updated (${rows.length} bookings)` });
    return { ok: true, action: "synced", url: `https://docs.google.com/spreadsheets/d/${id}`, tab, rows: rows.length };
  } catch (e) {
    const error = (e as Error).message ?? String(e);
    await supabase.from("google_integrations").update({ last_error: `Sheets: ${error}` }).eq("id", 1);
    return { ok: false, error };
  }
}
