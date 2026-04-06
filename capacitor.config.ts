import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Point the Android WebView at your deployed Next.js app (HTTPS).
 * Local dev (emulator): http://10.0.2.2:3000 — set cleartext via server.cleartext below.
 *
 * Example: CAPACITOR_SERVER_URL=https://your-app.vercel.app npx cap sync
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ??
  "https://REPLACE_WITH_YOUR_DEPLOYED_APP_URL";

const config: CapacitorConfig = {
  appId: "com.madvins.expensetracker",
  appName: "MaD ViNS Studio",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http:"),
  },
};

export default config;
