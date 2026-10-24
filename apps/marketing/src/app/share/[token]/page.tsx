import type { Metadata } from "next";

import { loadSharedDocument } from "../../../lib/load-shared-document";
import {
  OUTAGE_DOCUMENT_MESSAGE,
  UNAVAILABLE_DOCUMENT_MESSAGE,
  shareCard,
  shareDocumentHtml,
} from "../../../lib/share-document";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { token } = await params;
  const document = await loadSharedDocument(token);
  if (document.status !== "ok") {
    const message = document.status === "unavailable"
      ? UNAVAILABLE_DOCUMENT_MESSAGE
      : OUTAGE_DOCUMENT_MESSAGE;
    return {
      title: { absolute: message },
      description: message,
      robots: { index: false, follow: false, noarchive: true },
      openGraph: { title: message, description: message },
    };
  }
  const card = shareCard(document);
  return {
    title: { absolute: card.title },
    description: card.shortDescription,
    robots: { index: false, follow: false, noarchive: true },
    openGraph: {
      title: card.title,
      description: card.shortDescription,
      siteName: document.payload.businessName,
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
