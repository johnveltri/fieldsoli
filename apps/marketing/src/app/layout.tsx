import type { Metadata, Viewport } from "next";

import { SiteAnalytics } from "../components/SiteAnalytics";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fieldsoli.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FieldSoli | Job & Profit Tracker for Tradespeople",
    template: "%s | FieldSoli",
  },
  description:
    "FieldSoli helps skilled trade professionals keep jobs, notes, materials, and profit tracking all in one place. ",
  applicationName: "FieldSoli",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4eddf",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
