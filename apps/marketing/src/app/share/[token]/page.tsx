import type { Metadata } from "next";

import { loadSharedDocument } from "../../../lib/load-shared-document";
import { shareCard, shareDocumentHtml } from "../../../lib/share-document";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const document = await loadSharedDocument(token);
  if (document.status !== "ok") {
    return {
      title: "Document",
      robots: { index: false, follow: false },
    };
  }
  const card = shareCard(document);
  return {
    title: card.title,
    description: card.shortDescription,
    robots: { index: false, follow: false },
    openGraph: {
      title: card.title,
      description: card.shortDescription,
      siteName: "fieldsoli.com",
    },
  };
}

export default async function ShareDocumentPage({ params }: SharePageProps) {
  const { token } = await params;
  const html = shareDocumentHtml(await loadSharedDocument(token));
  const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
  const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? html;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: style }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
