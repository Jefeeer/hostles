import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BookingRow, MonthSummary, SheetColumn } from "@/lib/types";
import { activeColumns } from "@/lib/sheet";

// Built-in Helvetica has no ₱ glyph, so PDFs use the ISO code ("PHP 18,000").
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "code", maximumFractionDigits: 0 });
const fmt = (n: number) => money.format(n).replace(/ /g, " ");

// Pass bytes, not a path: react-pdf treats "C:\…" as a URL and tries to fetch it.
let logoBytes: Buffer | null = null;
const logo = () => (logoBytes ??= readFileSync(join(process.cwd(), "public/brand/lester-script.png")));

const C = { brand: "#FF6600", deep: "#C24700", ink: "#17110C", muted: "#6B5E52", line: "#E6DCCB", soft: "#F4ECDF" };

const s = StyleSheet.create({
  page: { padding: 28, fontSize: 8, fontFamily: "Helvetica", color: C.ink },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  logo: { width: 64 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  sub: { color: C.muted, marginTop: 2 },
  stats: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: C.soft, borderRadius: 4, padding: 8 },
  statLabel: { fontSize: 7, color: C.muted, textTransform: "uppercase" },
  statValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line },
  th: { backgroundColor: C.ink, color: "#FFFFFF", fontFamily: "Helvetica-Bold", fontSize: 7, textTransform: "uppercase" },
  cell: { paddingVertical: 4, paddingHorizontal: 4 },
  right: { textAlign: "right" },
  cancelled: { color: C.muted, textDecoration: "line-through" },
  foot: { fontFamily: "Helvetica-Bold", backgroundColor: C.soft },
  footer: { position: "absolute", bottom: 14, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", color: C.muted, fontSize: 7 },
});

export function MonthReport({ title, subtitle, rows, columns, summary }: {
  title: string;
  subtitle: string;
  rows: BookingRow[];
  columns: SheetColumn[];
  summary: MonthSummary;
}) {
  const cols = activeColumns(columns);
  const live = rows.filter((r) => r.status !== "cancelled");
  const c = summary.current;

  return (
    <Document title={title} author="Host Lester">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.title}>{title}</Text>
            <Text style={s.sub}>{subtitle}</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.logo} src={{ data: logo(), format: "png" }} />
        </View>

        <View style={s.stats}>
          {[
            ["Bookings", String(c.bookings)],
            ["Expected", fmt(c.expected)],
            ["Collected", fmt(c.collected)],
            ["Outstanding", fmt(c.outstanding)],
          ].map(([l, v]) => (
            <View key={l} style={s.stat}>
              <Text style={s.statLabel}>{l}</Text>
              <Text style={s.statValue}>{v}</Text>
            </View>
          ))}
        </View>

        <View style={[s.tr, s.th]} fixed>
          {cols.map((col) => (
            <Text key={col.key} style={[s.cell, { flex: col.field.width ?? 10 }, col.field.money ? s.right : {}]}>{col.label}</Text>
          ))}
        </View>
        {rows.map((b) => (
          <View key={b.id} style={s.tr} wrap={false}>
            {cols.map((col) => {
              const v = col.field.value(b);
              return (
                <Text key={col.key} style={[s.cell, { flex: col.field.width ?? 10 }, col.field.money ? s.right : {}, b.status === "cancelled" ? s.cancelled : {}]}>
                  {col.field.money ? fmt(Number(v)) : String(v)}
                </Text>
              );
            })}
          </View>
        ))}
        <View style={[s.tr, s.foot]}>
          {cols.map((col, i) => (
            <Text key={col.key} style={[s.cell, { flex: col.field.width ?? 10 }, col.field.money ? s.right : {}]}>
              {col.field.money
                ? fmt(live.reduce((sum, r) => sum + Number(col.field.value(r) || 0), 0))
                : i === 0 ? `${live.length} events` : ""}
            </Text>
          ))}
        </View>

        <View style={s.footer} fixed>
          <Text>Host Lester · Events Host</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
