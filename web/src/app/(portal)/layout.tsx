import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { THEME_SCRIPT, ThemedToaster } from "@/components/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../globals.css";

// Same type as the public site (and the old hostles admin): Manrope for text, Anton for headings.
const manrope = localFont({ src: "../fonts/manrope.woff2", weight: "200 800", variable: "--font-manrope" });
const anton = localFont({ src: "../fonts/anton.woff2", variable: "--font-anton" });

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
    { media: "(prefers-color-scheme: dark)", color: "#070707" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Dark (hostles admin look) by default; THEME_SCRIPT applies a saved Light/System choice before paint.
    // suppressHydrationWarning: that script and browser extensions change attributes on <html>/<body>.
    <html lang="en-PH" data-theme="dark" className={`${manrope.variable} ${anton.variable} h-full antialiased`} suppressHydrationWarning>
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
