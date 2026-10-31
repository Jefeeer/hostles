import Image from "next/image";
import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { cookies } from "next/headers";
import { AdminSidebar } from "@/components/admin-sidebar";
import { BottomNav } from "@/components/app-nav";
import { ConfirmButton } from "@/components/confirm-button";
import { ThemeToggleButton } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { requireAdmin } from "@/lib/data";
import { signOut } from "../login/actions";

export default async function AdminLayout({ children, drawer }: LayoutProps<"/">) {
  const supabase = await requireAdmin();
  // Open leads (new inquiries + dates on hold, e.g. from the website form): badge on "Leads & bookings".
  const { data: leads } = await supabase.from("bookings").select("id").in("status", ["inquiry", "on_hold"]);

  return (
    <div className="min-h-dvh lg:flex">
      <AdminSidebar leads={leads?.length ?? 0} signOut={signOut} defaultCollapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed"} />

      <div className="min-w-0 flex-1">
        {/* Phone header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar text-sidebar-foreground px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
          <Link href="/dashboard" aria-label="Home" className="flex items-center gap-2">
            <Image src="/brand/lester-script.png" alt="Lester" width={72} height={49} className="h-8 w-auto" priority />
            <span className="font-display text-sm tracking-[0.04em] uppercase">Admin</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggleButton />
            <Button asChild size="sm" className="font-semibold">
              <Link href="/bookings/new"><Plus /> Booking</Link>
            </Button>
            <ConfirmButton action={signOut} title="Log out?" description="You'll need your email and password to sign in again." confirmLabel="Log out" icon={<LogOut />} variant="ghost" size="icon-sm" aria-label="Log out" className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <LogOut />
            </ConfirmButton>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 sm:px-6 lg:px-12 lg:pb-12 lg:pt-8">{children}</main>
      </div>
      <BottomNav leads={leads?.length ?? 0} />
      {drawer}
    </div>
  );
}
