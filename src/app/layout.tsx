import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ToastifyProvider from "@/components/ToastifyProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Expense tracker",
  description: "Team expense tracking, summaries, and backups.",
  icons: { icon: "/logo.svg" },
  appleWebApp: { capable: true, title: "Expense tracker", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1B1B3A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegister />
        <ToastifyProvider>{children}</ToastifyProvider>
      </body>
    </html>
  );
}
