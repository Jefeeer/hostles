"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { SideNav } from "@/components/app-nav";
import { ConfirmButton } from "@/components/confirm-button";
import { ThemeSwitch, ThemeToggleButton } from "@/components/theme";
import { Button } from "@/components/ui/button";
import { SIDEBAR_COOKIE } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Desktop sidebar (hostles admin style). Collapses to icons only; the choice is kept in a cookie so the server renders it right. */
export function AdminSidebar({ leads, signOut, defaultCollapsed }: { leads: number; signOut: () => Promise<void>; defaultCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col gap-5 overflow-y-auto border-r border-sidebar-border bg-sidebar py-6 text-sidebar-foreground transition-[width] duration-200 lg:flex",
        // Still scrolls on short screens, just without a visible scrollbar.
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        collapsed ? "w-[84px] px-3" : "w-[264px] px-4",
      )}
    >
      <div className={cn("flex items-center border-b border-sidebar-border pb-5", collapsed ? "flex-col gap-3" : "justify-between gap-2 px-2.5")}>
        <Link href="/dashboard" className="flex items-center gap-3" aria-label="Dashboard">
          <Image src="/brand/lester-script.png" alt="Lester" width={120} height={81} priority className={cn("h-auto transition-[width]", collapsed ? "w-11" : "w-16")} />
          {!collapsed && <span className="font-display text-lg tracking-[0.04em] uppercase">Admin</span>}
        </Link>
        <button type="button" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid size-8 place-items-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <ToggleIcon className="size-[18px]" />
        </button>
      </div>

      <Button asChild className={cn("h-10 font-semibold", collapsed && "mx-auto size-10 px-0")} title="New booking">
        <Link href="/bookings/new"><Plus />{!collapsed && " New booking"}{collapsed && <span className="sr-only">New booking</span>}</Link>
      </Button>

      <SideNav leads={leads} collapsed={collapsed} />

      <div className="mt-auto grid gap-0.5 border-t border-sidebar-border pt-4">
        {collapsed ? <ThemeToggleButton className="mx-auto mb-1 size-10" /> : <ThemeSwitch className="mb-2" />}
        <ConfirmButton action={signOut} title="Log out?" description="You'll need your email and password to sign in again." confirmLabel="Log out" icon={<LogOut />}
          variant="ghost" aria-label="Log out"
          className={cn("h-auto gap-3 rounded-[10px] py-2.5 text-[13px] font-medium text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "mx-auto size-10 justify-center px-0" : "w-full justify-start px-3")}>
          <LogOut className="size-[18px]" />{!collapsed && " Log out"}
        </ConfirmButton>
        <div className={cn("mt-3 flex items-center gap-3 rounded-xl bg-sidebar-accent", collapsed ? "justify-center p-2" : "p-3")} title={collapsed ? "Sir Lester · Site owner" : undefined}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-display text-lg text-black" aria-hidden>L</span>
          {!collapsed && <span className="grid leading-tight"><strong className="text-sm">Sir Lester</strong><small className="text-xs text-sidebar-foreground/60">Site owner</small></span>}
        </div>
      </div>
    </aside>
  );
}
