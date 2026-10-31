import Image from "next/image";
import type { Metadata } from "next";
import { CircleCheck, Download } from "lucide-react";
import { findContractByToken } from "@/lib/contracts";
import { fmtStamp } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/server";
import { SignForm } from "./sign-form";

export const metadata: Metadata = { title: "Your contract", robots: { index: false, follow: false } };

export default async function ContractPage({ params }: PageProps<"/c/[token]">) {
  const { token } = await params;
  const supabase = await createServiceClient();
  const found = await findContractByToken(supabase, token);

  if (found && found.contract.status === "sent" && !found.contract.viewed_at) {
    await supabase.from("contracts").update({ viewed_at: new Date().toISOString() }).eq("id", found.contract.id);
  }

  const expired = found && found.contract.status === "sent" && new Date(found.contract.expires_at) < new Date();

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="bg-stage px-4 py-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Image src="/brand/lester-script.png" alt="Lester" width={90} height={61} className="h-9 w-auto" priority />
          <span className="text-[10px] font-semibold tracking-[0.28em] text-cream/70">EVENTS HOST</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {!found ? (
          <Notice title="This link isn't valid">Please check that you opened the latest email from Lester, or reply to it for a new link.</Notice>
        ) : found.contract.status === "void" ? (
          <Notice title="This contract was replaced">Lester sent a newer version. Please use the link in the most recent email.</Notice>
        ) : expired ? (
          <Notice title="This link has expired">Please reply to Lester&apos;s email and he&apos;ll send you a fresh link.</Notice>
        ) : (
          <>
            {found.contract.status === "signed" && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50 p-4 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                <CircleCheck className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Signed. Thank you, {found.contract.signer_name}!</p>
                  <p className="text-sm">Signed {fmtStamp(found.contract.signed_at!)} (Manila time). Deposit details are on their way to your email.</p>
                </div>
              </div>
            )}

            <article className="rounded-xl border bg-card p-5 shadow-xs sm:p-8">
              <ContractBody text={found.contract.body} />
            </article>

            <div className="my-4 flex justify-end">
              <a href={`/c/${token}/pdf`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-deep hover:underline dark:text-brand">
                <Download className="size-4" /> Download PDF
              </a>
            </div>

            {found.contract.status === "sent" && (
              <section className="rounded-xl border bg-card p-5 sm:p-8">
                <h2 className="text-lg font-bold">Sign this agreement</h2>
                <p className="mb-5 text-sm text-muted-foreground">Link valid until {fmtStamp(found.contract.expires_at, "MMMM d, yyyy")}.</p>
                <SignForm token={token} defaultName={found.booking.client?.full_name ?? ""} />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ContractBody({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-[15px] leading-relaxed">
      {text.split("\n").map((line, i) =>
        line.startsWith("# ") ? (
          i === 0
            ? <h1 key={i} className="mb-2 text-2xl font-bold tracking-tight">{line.slice(2)}</h1>
            : <h2 key={i} className="pt-4 text-sm font-bold tracking-wide text-brand-deep uppercase dark:text-brand">{line.slice(2)}</h2>
        ) : line.trim() ? <p key={i}>{line}</p> : <div key={i} className="h-1" />,
      )}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-8 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{children}</p>
    </div>
  );
}
