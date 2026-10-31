import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { SubmitButton } from "./submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const field = "h-11 rounded-[10px] border-white/15 bg-[#050505] px-3.5 text-[15px] text-white placeholder:text-white/35 hover:border-white/30 autofill:shadow-[inset_0_0_0_1000px_#050505] autofill:[-webkit-text-fill-color:#fff]";

// Hostles admin look: stage photo + Anton headline on one side, the sign-in card on the other. Always dark.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const demo = process.env.DEMO_MODE === "1";

  return (
    <main className="min-h-dvh bg-[#070707] text-white lg:grid lg:h-dvh lg:grid-cols-[1.1fr_1fr] lg:overflow-hidden">
      {/* Photo side (a short banner on phones) */}
      <section className="relative h-56 overflow-hidden sm:h-72 lg:h-auto">
        <Image src="/assets/lester-on-stage.jpg" alt="" fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover object-[30%_20%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070707] via-[#070707]/45 to-transparent lg:bg-gradient-to-r lg:from-black/70 lg:via-black/30 lg:to-[#070707]" />
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:top-auto lg:p-14">
          <p className="mb-3 flex items-center gap-2.5 text-[11px] font-bold tracking-[0.2em] uppercase">
            <span className="h-0.5 w-5 bg-brand" aria-hidden /> Events host &amp; voice-over
          </p>
          <h2 className="hidden font-display text-[56px] leading-[0.95] tracking-[0.01em] uppercase lg:block xl:text-[72px]">
            Every event,<br /><span className="text-brand">one place.</span>
          </h2>
          <p className="mt-4 hidden max-w-md text-[15px] text-white/66 lg:block">Leads, bookings, contracts, payments and your website, all in one portal.</p>
        </div>
      </section>

      {/* Sign-in side */}
      <section className="flex items-center justify-center px-5 pb-12 pt-2 sm:px-10 lg:py-6">
        <div className="w-full max-w-[400px]">
          <Image src="/brand/lester-script.png" alt="Lester" width={172} height={116} priority className="mb-6 h-auto w-24 [@media(min-width:1024px)_and_(max-height:720px)]:hidden" />
          <p className="mb-2 text-[11px] font-bold tracking-[0.18em] text-brand uppercase">Admin / Sign in</p>
          <h1 className="font-display text-[40px] leading-none tracking-[0.01em] uppercase sm:text-[46px]">Welcome back</h1>
          <p className="mt-3 text-[15px] text-white/66">Sign in to manage your bookings and website.</p>

          <form action={signIn} className="mt-6 space-y-4">
            <input type="hidden" name="next" value={typeof next === "string" ? next : "/dashboard"} />
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-semibold">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com"
                defaultValue={demo ? "demo@hostlester.local" : undefined} className={field} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-semibold">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••"
                defaultValue={demo ? "demo1234" : undefined} className={field} />
            </div>
            {demo && (
              <p className="rounded-[10px] border border-brand/30 bg-brand/10 px-3.5 py-2.5 text-xs text-white/85">
                <strong>Demo mode</strong> · sample data, resets when the server restarts. Login: demo@hostlester.local / demo1234
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-[10px] border border-[#ff4d4d]/40 bg-[#ff4d4d]/10 px-3.5 py-2.5 text-sm text-[#ff8a8a]">
                {error === "config"
                  ? "Supabase isn't configured yet. See README → Setup."
                  : error === "forbidden"
                    ? "This account isn't an admin. Sign in with the admin account."
                    : "Wrong email or password."}
              </p>
            )}
            <SubmitButton />
          </form>

          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-xs font-bold tracking-[0.16em] text-white/66 uppercase hover:text-brand">
            <ArrowLeft className="size-4" /> Back to website
          </Link>
        </div>
      </section>
    </main>
  );
}
