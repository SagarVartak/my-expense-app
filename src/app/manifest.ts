import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_LOGO_PATH, APP_NAME } from "@/lib/appMeta";

/** Web App Manifest — installable PWA metadata (see also public/sw.js). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#090b10",
    theme_color: "#090b10",
    categories: ["finance", "productivity", "business"],
    icons: [
      {
        src: APP_LOGO_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: APP_LOGO_PATH,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
