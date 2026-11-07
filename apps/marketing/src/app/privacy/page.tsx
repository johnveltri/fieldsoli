import type { Metadata } from "next";
import { publicPageMetadata } from "../../lib/search-metadata";

import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  ...publicPageMetadata("/privacy"),
  title: "Privacy Policy",
  description: "How FieldSoli collects, uses, retains, and protects personal information.",
};

export default function PrivacyPage() {
  return <LegalDocument fileName="privacy-policy.md" />;
}
