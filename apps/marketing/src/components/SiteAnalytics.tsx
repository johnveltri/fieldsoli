"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";

/**
 * Download links are bearer credentials. Keep the redemption surface out of
 * analytics so a token-bearing navigation cannot be observed by a third
 * party, even though the token is removed from the URL before redemption.
 */
export function SiteAnalytics() {
  const pathname = usePathname();

  if (pathname === "/exports/download" || pathname.startsWith("/share/")) return null;

  return <Analytics />;
}
