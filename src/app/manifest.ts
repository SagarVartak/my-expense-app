import type { MetadataRoute } from "next";

/** Web App Manifest — installable PWA metadata (see also public/sw.js). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MaD ViNS Studio — Expense tracker",
    short_name: "Expense tracker",
    description: "Team expense tracking, orders, inventory, and approvals.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#1B1B3A",
    theme_color: "#1B1B3A",
    categories: ["finance", "productivity", "business"],
    icons: [
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/logo.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
