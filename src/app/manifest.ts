import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aya's Dashboard",
    short_name: "Aya's",
    description: "A personal life dashboard — calm, clear, and grounded.",
    // Absolute, not "/". A home-screen icon added while viewing a preview
    // deployment would otherwise pin that build forever — every launch opens a
    // frozen copy of the app, and fixes look like they never shipped.
    start_url: SITE_URL,
    display: "standalone",
    background_color: "#FAF6F1",
    theme_color: "#B4552F",
    orientation: "portrait",
    icons: [
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
