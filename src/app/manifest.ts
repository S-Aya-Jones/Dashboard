import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aya's Dashboard",
    short_name: "Aya's",
    description: "A personal life dashboard — calm, clear, and grounded.",
    start_url: "/",
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
