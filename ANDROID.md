# Android app (Capacitor) — MaD ViNS Studio

This project uses **Capacitor** so the Next.js app can run inside an Android **WebView**. The native shell points at your **deployed** site (or a dev URL), because this app uses **API routes and server features** that are not available from a plain static export.

## What was added

- **Logo files**
  - `public/branding/mad-vins-logo.png` — for web/PWA use if you want it in the UI.
  - `resources/icon.png` — same image; use this as the source when generating Android launcher icons (see below).
- **`www/index.html`** — minimal local bundle Capacitor requires for `webDir`.
- **`capacitor.config.ts`** — `appName` **MaD ViNS Studio**, `appId` **com.madvins.expensetracker**, and **`server.url`** for where the WebView loads your app.
- **`android/`** — native Android project (open this folder in Android Studio).

## 1. Prerequisites

- **Node.js** (project already uses npm).
- **Android Studio** (install Android SDK, Platform Tools, and at least one emulator or a USB-debugging device).
- On first open, Android Studio usually creates **`android/local.properties`** with `sdk.dir=...`. If Gradle says “SDK location not found”, set **`ANDROID_HOME`** to your SDK path or add `sdk.dir` in `local.properties` (that file is gitignored).

## 2. Point the app at your Next.js URL

Set the URL **before** `cap sync` so it is baked into `android/app/src/main/assets/capacitor.config.json`.

**Production (recommended):** deploy the app (e.g. Vercel), then:

```bash
export CAPACITOR_SERVER_URL="https://your-production-domain.example"
npx cap sync
```

**Local dev on Android emulator** (Next.js on your Mac, port 3000):

```bash
export CAPACITOR_SERVER_URL="http://10.0.2.2:3000"
npx cap sync
```

`10.0.2.2` is the emulator’s alias for the host machine’s localhost. For a **physical device** on the same Wi‑Fi, use your computer’s LAN IP, e.g. `http://192.168.1.50:3000`, and ensure the phone can reach that address (firewall).

HTTP uses cleartext; `capacitor.config.ts` sets `server.cleartext` when the URL starts with `http:`.

Edit the default placeholder in `capacitor.config.ts` if you prefer not to use env vars:

```ts
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ?? "https://your-real-url";
```

## 3. Use your logo as the app icon

The automated `@capacitor/assets` icon generator was not added (it depends on native **sharp** builds). Use **Android Studio**:

1. Open the **`android`** folder in Android Studio.
2. In the project tree: **android/app/src/main/res**.
3. Right‑click **res** → **New** → **Image Asset**.
4. **Icon Type:** Launcher Icons (Adaptive and Legacy).
5. **Path:** choose `resources/icon.png` from this repo (navy background + cube — works as full-bleed launcher art).
6. Adjust **trim** / **padding** if the preview looks too tight; set background color to **#1B1B3A** if you use a layered adaptive icon.
7. Finish — Studio updates `mipmap-*` and adaptive XML.

Then run **`npx cap sync`** only if you changed web assets or `capacitor.config.ts`; icon changes under `android/res` are kept by Studio.

## 4. Build a debug APK

From the repo root:

```bash
npm run cap:sync
cd android && ./gradlew assembleDebug
```

APK output:

`android/app/build/outputs/apk/debug/app-debug.apk`

Install on a device: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`, or drag the APK onto an emulator.

Or use Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

## 5. Release APK / Play App Bundle (Play Store)

1. In Android Studio: **Build → Generate Signed Bundle / APK**.
2. Create or select a **keystore**; keep it backed up and private.
3. Choose **Android App Bundle** (Play) or **APK** (sideload).
4. Increment **`versionCode` / `versionName`** in `android/app/build.gradle` when publishing updates.

## 6. Useful npm scripts

| Script | Purpose |
|--------|--------|
| `npm run cap:sync` | Copy web assets + config into `android/` |
| `npm run cap:open:android` | Open the Android project in Android Studio |
| `npm run cap:android:debug` | Sync then build debug APK with Gradle |

## Troubleshooting

- **Blank / wrong page:** Check `CAPACITOR_SERVER_URL`, run `npx cap sync`, reinstall the app.
- **Cookies / login:** Use **HTTPS** in production; same-site cookies should work for your deployed origin.
- **Cleartext / HTTP blocked:** Ensure `server.cleartext` is true for `http:` URLs (already handled in `capacitor.config.ts`).

For Capacitor workflow details, see: https://capacitorjs.com/docs/basics/workflow
