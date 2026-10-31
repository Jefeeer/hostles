import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { THEME_SCRIPT, ThemedToaster } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Host Lester", template: "%s · Host Lester" },
  description: "Booking & business portal for Host Lester: events host and voice-over talent.",
  applicationName: "Host Lester",
  appleWebApp: { capable: true, title: "Host Lester", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0c0b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: THEME_SCRIPT sets data-theme before React loads, and
    // browser extensions (e.g. ColorZilla) add attributes to <html>/<body>.
    <html lang="en-PH" className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        <TooltipProvider>{children}</TooltipProvider>
        <ThemedToaster />
      </body>
    </html>
  );
}
