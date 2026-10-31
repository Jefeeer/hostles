import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// The app has two root layouts (public site + portal), so unmatched URLs land here.
export const metadata: Metadata = { title: "Page not found · Lester Events Host", robots: { index: false } };

export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-stage p-6 text-center text-cream">
        <main>
          <p className="text-sm font-bold tracking-[0.2em] text-brand uppercase">404</p>
          <h1 className="mt-2 text-3xl font-bold">This page doesn&rsquo;t exist</h1>
          <Link href="/" className="mt-6 inline-block rounded-full bg-brand px-5 py-2.5 font-semibold text-stage">Go to the home page</Link>
        </main>
      </body>
    </html>
  );
}
