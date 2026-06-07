import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aya's Dashboard",
    short_name: "Aya's",
    description: "A personal life dashboard — calm, clear, and grounded.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F0FE",
    theme_color: "#7C5CFC",
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
