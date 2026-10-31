import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Host Lester",
    short_name: "Host Lester",
    description: "Bookings, calendar and records for Host Lester.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0e0c0b",
    theme_color: "#0e0c0b",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512-maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
