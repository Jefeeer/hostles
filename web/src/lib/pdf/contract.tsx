import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fmtStamp } from "@/lib/format";
import type { Contract } from "@/lib/types";

let logoBytes: Buffer | null = null;
const logo = () => (logoBytes ??= readFileSync(join(process.cwd(), "public/brand/lester-script.png")));

const C = { deep: "#C24700", ink: "#17110C", muted: "#6B5E52", line: "#E6DCCB", soft: "#F4ECDF" };
const s = StyleSheet.create({
  page: { padding: 48, paddingBottom: 64, fontSize: 10.5, lineHeight: 1.5, fontFamily: "Helvetica", color: C.ink },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 12, marginBottom: 18 },
  logo: { width: 72 },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.deep, textTransform: "uppercase", letterSpacing: 0.8, marginTop: 14, marginBottom: 4 },
  p: { marginBottom: 2 },
  sigBox: { marginTop: 28, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 14, flexDirection: "row", gap: 24 },
  sigCol: { flex: 1 },
  sigLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  sigTyped: { fontSize: 22, fontFamily: "Helvetica-Oblique", marginVertical: 6 },
  sigImg: { height: 56, objectFit: "contain", marginVertical: 4 },
  audit: { marginTop: 18, padding: 10, backgroundColor: C.soft, fontSize: 8, color: C.muted, borderRadius: 4 },
  pending: { marginTop: 28, padding: 12, borderWidth: 1, borderStyle: "dashed", borderColor: C.deep, color: C.deep, textAlign: "center" },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: C.muted },
});

/** Body format: "# Heading" lines, blank lines between paragraphs. */
function Body({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return i === 0 ? <Text key={i} style={s.h1}>{line.slice(2)}</Text> : <Text key={i} style={s.h2}>{line.slice(2)}</Text>;
        if (!line.trim()) return <Text key={i} style={{ height: 4 }}> </Text>;
        return <Text key={i} style={s.p}>{line}</Text>;
      })}
    </>
  );
}

export function ContractPdf({ contract, clientName }: { contract: Contract; clientName: string }) {
  const signed = contract.status === "signed" && contract.signed_at;
  return (
    <Document title={contract.title} author="Host Lester">
      <Page size="A4" style={s.page}>
        <View style={s.head} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image style={s.logo} src={{ data: logo(), format: "png" }} />
          <Text style={{ fontSize: 8, color: C.muted }}>{contract.status === "void" ? "VOID: superseded" : signed ? "SIGNED" : "AWAITING SIGNATURE"}</Text>
        </View>
        <Body text={contract.body} />

        {signed ? (
          <View wrap={false}>
            <View style={s.sigBox}>
              <View style={s.sigCol}>
                <Text style={s.sigLabel}>Client</Text>
                {contract.signature_image
                  // eslint-disable-next-line jsx-a11y/alt-text
                  ? <Image style={s.sigImg} src={contract.signature_image} />
                  : <Text style={s.sigTyped}>{contract.signature_text ?? contract.signer_name}</Text>}
                <Text>{contract.signer_name}</Text>
                <Text style={{ color: C.muted, fontSize: 9 }}>Signed {fmtStamp(contract.signed_at!, "MMMM d, yyyy 'at' h:mm a")} (Manila)</Text>
              </View>
              <View style={s.sigCol}>
                <Text style={s.sigLabel}>Host</Text>
                <Text style={s.sigTyped}>Lester</Text>
                <Text>Host Lester</Text>
              </View>
            </View>
            <View style={s.audit}>
              <Text>Electronic signature record · Contract {contract.id}</Text>
              <Text>Signed by {contract.signer_name} for {clientName} · IP {contract.signer_ip ?? "-"} · {contract.signed_at}</Text>
              <Text>Document fingerprint (SHA-256): {contract.content_hash}</Text>
            </View>
          </View>
        ) : (
          <Text style={s.pending}>Not yet signed. Link valid until {fmtStamp(contract.expires_at, "MMMM d, yyyy")}.</Text>
        )}

        <View style={s.footer} fixed>
          <Text>Host Lester · Events Host</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
