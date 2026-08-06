"use client";

import Script from "next/script";
import { useEffect } from "react";

interface AdSenseProviderProps {
  children: React.ReactNode;
  publisherId?: string;
}

declare global {
  interface Window {
    adsbygoogle: Array<Record<string, unknown>>;
  }
}

export default function AdSenseProvider({
  children,
  publisherId,
}: AdSenseProviderProps) {
  const pubId = publisherId || process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;

  useEffect(() => {
    if (typeof window !== "undefined" && pubId) {
      (window.adsbygoogle = window.adsbygoogle || []).push({
        google_ad_client: pubId,
        enable_page_level_ads: true,
      });
    }
  }, [pubId]);

  if (!pubId || process.env.NODE_ENV !== "production") {
    return <>{children}</>;
  }

  return (
    <>
      <Script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pubId}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      {children}
    </>
  );
}