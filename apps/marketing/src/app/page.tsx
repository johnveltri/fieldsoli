import type { Metadata } from "next";
import { ApprovedMarketingPage, approvedPages } from "../components/approved/ApprovedMarketingPage";
export const metadata: Metadata = {
  title: { absolute: approvedPages.home.title }, description: approvedPages.home.description,
  alternates: { canonical: "https://fieldsoli.com/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};
export default function HomePage() { return <ApprovedMarketingPage pageKey="home" />; }
