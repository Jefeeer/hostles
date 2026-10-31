import Image from "next/image";
import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { BottomNav, SideNav } from "@/components/app-nav";
import { ThemeSwitch, ThemeToggleButton } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/data";
import { signOut } from "../login/actions";

export default async function AdminLayout({ children, drawer }: LayoutProps<"/">) {
  const supabase = await requireAdmin();
  // Open leads (new inquiries + dates on hold, e.g. from the website form): badge on "Leads & bookings".
  const { data: leads } = await supabase.from("bookings").select("id").in("status", ["inquiry", "on_hold"]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col overflow-y-auto bg-sidebar px-4 py-5 lg:flex">
        <Link href="/dashboard" className="mb-5 flex items-end gap-2 px-2">
          <Image src="/brand/lester-script.png" alt="Lester" width={120} height={81} className="h-auto w-14" priority />
          <span className="pb-1 text-[9px] font-semibold tracking-[0.24em] text-sidebar-foreground/60">EVENTS HOST</span>
        </Link>
        <Button asChild size="lg" className="mb-5 h-10 font-semibold">
          <Link href="/bookings/new"><Plus /> New booking</Link>
        </Button>
        <SideNav leads={leads?.length ?? 0} />
        <ThemeSwitch className="mt-auto mb-3" />
        <form action={signOut}>
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="size-4" /> Sign out
          </button>
        </form>
      </aside>

      <div className="min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
          <Link href="/dashboard" aria-label="Home">
            <Image src="/brand/lester-script.png" alt="Lester" width={72} height={49} className="h-8 w-auto" priority />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggleButton />
            <Button asChild size="sm" className="font-semibold">
              <Link href="/bookings/new"><Plus /> Booking</Link>
            </Button>
            <form action={signOut}>
              <Button variant="ghost" size="icon-sm" aria-label="Sign out" className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <LogOut />
              </Button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>
      <BottomNav leads={leads?.length ?? 0} />
      {drawer}
    </div>
  );
}
