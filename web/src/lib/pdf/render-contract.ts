import "server-only";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { Contract } from "@/lib/types";
import { ContractPdf } from "./contract";

export async function contractPdfResponse(contract: Contract, clientName: string, download = false) {
  const buf = await renderToBuffer(createElement(ContractPdf, { contract, clientName }) as Parameters<typeof renderToBuffer>[0]);
  const name = `contract-${contract.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60)}.pdf`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
