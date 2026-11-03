import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApprovedMarketingPage, approvedPages, type ApprovedPageKey } from "../../../components/approved/ApprovedMarketingPage";
const slugs = Object.keys(approvedPages).filter(key => key !== "home");
function getKey(slug: string): ApprovedPageKey { if (!slugs.includes(slug)) notFound(); return slug as ApprovedPageKey; }
export function generateStaticParams() { return slugs.map(slug => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const page = approvedPages[getKey(slug)];
  return { title: { absolute: page.title }, description: page.description, alternates: { canonical: `https://fieldsoli.com/guides/${slug}/` }, robots: { index: true, follow: true, googleBot: { index: true, follow: true } } };
}
export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; return <ApprovedMarketingPage pageKey={getKey(slug)} />;
}
