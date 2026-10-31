"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays, ExternalLink, Globe, Inbox, LayoutDashboard, Menu, PartyPopper, Settings, SquareKanban, Users, type LucideIcon,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; hint: string; icon: LucideIcon; external?: boolean; badge?: "leads" };

/** The sidebar, grouped by job so it's clear where to click. */
const NAV_GROUPS: { label: string; items: Item[] }[] = [
  { label: "Today", items: [
    { href: "/dashboard", label: "Dashboard", hint: "What needs you today", icon: LayoutDashboard },
  ] },
  { label: "Bookings", items: [
    { href: "/bookings", label: "Leads & bookings", hint: "Inquiries and all bookings", icon: SquareKanban, badge: "leads" },
    { href: "/records", label: "Calendar & records", hint: "Month view, money, export", icon: CalendarDays },
    { href: "/events", label: "Special events", hint: "Series with many entries", icon: PartyPopper },
    { href: "/clients", label: "Clients", hint: "People you work with", icon: Users },
  ] },
  { label: "Website", items: [
    { href: "/website", label: "Edit website", hint: "Photos, videos, text", icon: Globe },
    { href: "/", label: "View live site", hint: "Opens in a new tab", icon: ExternalLink, external: true },
  ] },
  { label: "Setup", items: [
    { href: "/outbox", label: "Email outbox", hint: "Emails the portal sent", icon: Inbox },
    { href: "/settings", label: "Settings", hint: "Rules, emails, packages", icon: Settings },
  ] },
];

/** Phone tab bar: the everyday pages; everything else is under "More". */
const TABS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: SquareKanban },
  { href: "/records", label: "Calendar", icon: CalendarDays },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/website", label: "Website", icon: Globe },
] as const;

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

export function SideNav({ leads, onNavigate, collapsed = false }: { leads: number; onNavigate?: () => void; collapsed?: boolean }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className={cn("flex flex-col", collapsed ? "gap-3" : "gap-5")}>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {collapsed
            ? <hr className="mx-2 mb-3 border-sidebar-border" aria-label={group.label} />
            : <p className="mb-2 px-3 text-[10px] font-bold tracking-[0.2em] text-sidebar-foreground/66 uppercase">{group.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {group.items.map(({ href, label, hint, icon: Icon, external, badge }) => {
              const active = !external && isActive(path, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    {...(external && { target: "_blank", rel: "noopener" })}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? label : undefined}
                    className={cn(
                      // hostles admin: orange-tinted active row with an orange bar on the sidebar edge.
                      "relative flex items-center gap-3 rounded-[10px] py-2.5 text-sidebar-foreground/66 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      // Fixed tint (not brand-soft): the sidebar is black in both themes.
                      "aria-[current=page]:bg-[rgb(255_102_0/0.14)] aria-[current=page]:text-sidebar-foreground",
                      collapsed ? "justify-center px-0 aria-[current=page]:before:-left-3" : "px-3",
                      "aria-[current=page]:before:absolute aria-[current=page]:before:inset-y-2 aria-[current=page]:before:-left-4 aria-[current=page]:before:w-[3px] aria-[current=page]:before:rounded-r aria-[current=page]:before:bg-brand",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", active && "text-brand")} />
                    {collapsed ? <span className="sr-only">{label}</span> : (
                      <span className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate text-sm font-semibold">{label}</span>
                        <span className="truncate text-[11px] text-sidebar-foreground/50">{hint}</span>
                      </span>
                    )}
                    {badge === "leads" && leads > 0 && collapsed && <span className="absolute top-1.5 right-2 size-2 rounded-full bg-brand" aria-label={`${leads} open leads`} />}
                    {badge === "leads" && leads > 0 && !collapsed && (
                      <span className="tabular rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-stage" title={`${leads} open ${leads === 1 ? "lead" : "leads"}`}>
                        {leads}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function BottomNav({ leads }: { leads: number }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const item = "relative flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium";
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-6">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn(item, active ? "text-brand" : "text-sidebar-foreground/60")}>
                <Icon className="size-5" />
                {label}
                {href === "/bookings" && leads > 0 && <span className="absolute top-1.5 left-1/2 ml-1.5 size-2 rounded-full bg-brand" aria-label={`${leads} open leads`} />}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={() => setOpen(true)} className={cn(item, "text-sidebar-foreground/60")}>
            <Menu className="size-5" />
            More
          </button>
        </li>
      </ul>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[min(320px,86vw)] overflow-y-auto bg-sidebar text-sidebar-foreground">
          <SheetHeader><SheetTitle className="text-sidebar-foreground">Menu</SheetTitle></SheetHeader>
          <div className="px-2 pb-6"><SideNav leads={leads} onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
