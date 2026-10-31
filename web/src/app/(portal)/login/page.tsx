import Image from "next/image";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const demo = process.env.DEMO_MODE === "1";

  return (
    <main className="grid min-h-dvh place-items-center bg-stage px-4 py-10 text-cream">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Image src="/brand/lester-script.png" alt="Lester" width={172} height={116} priority className="mx-auto h-auto w-40" />
          <p className="mt-3 text-xs font-semibold tracking-[0.3em] text-cream/70">EVENTS HOST · BOOKING PORTAL</p>
        </div>
        <form action={signIn} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <input type="hidden" name="next" value={typeof next === "string" ? next : "/dashboard"} />
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={demo ? "demo@hostlester.local" : undefined}
              className="h-11 border-white/15 bg-black/30 text-cream" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required defaultValue={demo ? "demo1234" : undefined}
              className="h-11 border-white/15 bg-black/30 text-cream" />
          </div>
          {demo && (
            <p className="rounded-lg bg-brand/15 px-3 py-2 text-xs text-cream/90">
              <strong>Demo mode</strong> · sample data, resets when the server restarts. Login: demo@hostlester.local / demo1234
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error === "config"
                ? "Supabase isn't configured yet. See README → Setup."
                : error === "forbidden"
                  ? "This account isn't an admin. Sign in with the admin account."
                  : "Wrong email or password."}
            </p>
          )}
          <Button type="submit" size="lg" className="h-11 w-full text-base font-semibold">Sign in</Button>
        </form>
      </div>
    </main>
  );
}
