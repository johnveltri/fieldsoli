import type { Metadata } from "next";
import { publicPageMetadata } from "../lib/search-metadata";
import { ApprovedMarketingPage, approvedPages } from "../components/approved/ApprovedMarketingPage";
export const metadata: Metadata = {
  title: { absolute: approvedPages.home.title }, description: approvedPages.home.description,
  ...publicPageMetadata("/"),
};
export default function HomePage() { return <ApprovedMarketingPage pageKey="home" />; }
