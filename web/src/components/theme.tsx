"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";
const KEY = "hl-theme";

/**
 * Runs in <head> before first paint (no light/dark flash): applies the saved choice,
 * or the OS setting, and follows OS changes while on "system".
 */
export const THEME_SCRIPT = `(function(){try{var k="${KEY}",m=matchMedia("(prefers-color-scheme: dark)");function a(){var c=null;try{c=localStorage.getItem(k)}catch(e){}var d=c==="dark"||(c!=="light"&&m.matches);document.documentElement.dataset.theme=d?"dark":"light"}a();m.addEventListener("change",a);window.__hlApplyTheme=a}catch(e){}})()`;

function readChoice(): ThemeChoice {
  try {
    const c = localStorage.getItem(KEY);
    return c === "light" || c === "dark" ? c : "system";
  } catch {
    return "system";
  }
}

function setChoice(c: ThemeChoice) {
  try {
    if (c === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, c);
  } catch {}
  (window as unknown as { __hlApplyTheme?: () => void }).__hlApplyTheme?.();
  window.dispatchEvent(new Event(KEY));
}

const subscribeChoice = (cb: () => void) => {
  window.addEventListener(KEY, cb);
  return () => window.removeEventListener(KEY, cb);
};

/** The theme actually showing, kept in sync with <html data-theme>. */
function useResolvedTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setTheme(el.dataset.theme === "dark" ? "dark" : "light");
    read();
    const obs = new MutationObserver(read);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Light / Dark / System switch (sidebar). */
export function ThemeSwitch({ className }: { className?: string }) {
  // Server doesn't know the saved choice: render "system", then the real one after hydration.
  const choice = useSyncExternalStore(subscribeChoice, readChoice, () => "system" as ThemeChoice);
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("grid grid-cols-3 gap-1 rounded-lg bg-sidebar-accent p-1", className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" role="radio" aria-checked={choice === value} title={label}
          onClick={() => setChoice(value)}
          className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground aria-checked:bg-sidebar aria-checked:text-sidebar-foreground aria-checked:shadow-sm">
          <Icon className="size-3.5" /><span className="sr-only sm:not-sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** One-tap toggle between light and dark (phone header). */
export function ThemeToggleButton({ className }: { className?: string }) {
  const theme = useResolvedTheme();
  const next = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button type="button" onClick={() => setChoice(next)} aria-label={`Switch to ${next} mode`} title={`Switch to ${next} mode`}
      className={cn("grid size-8 place-items-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground", className)}>
      <Icon className="size-4" />
    </button>
  );
}

/** Toasts follow the app theme, not just the OS. */
export function ThemedToaster() {
  const theme = useResolvedTheme();
  return <Toaster theme={theme} position="top-center" richColors closeButton />;
}
