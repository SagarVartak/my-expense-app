import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
        <ToastifyProvider>{children}</ToastifyProvider>
      </body>
    </html>
  );
}
