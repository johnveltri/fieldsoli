import { ImageResponse } from "next/og";

import { loadSharedDocument } from "../../../lib/load-shared-document";
import { shareCard } from "../../../lib/share-document";

export const dynamic = "force-dynamic";
export const alt = "FieldSoli document";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ShareCardImage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const document = await loadSharedDocument((await params).token);
  if (document.status !== "ok") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "white",
            color: "black",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          FieldSoli
        </div>
      ),
      { ...size },
    );
  }
  const card = shareCard(document);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "white",
          color: "black",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          fontSize: 36,
        }}
      >
        <div style={{ display: "flex", fontSize: 28 }}>fieldsoli.com</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 56 }}>{card.businessName}</div>
          <div style={{ display: "flex" }}>{card.typeNumber}</div>
          <div style={{ display: "flex" }}>{card.shortDescription}</div>
        </div>
        <div style={{ display: "flex", fontSize: 48 }}>{dollars(card.totalCents)}</div>
      </div>
    ),
    { ...size },
  );
}
