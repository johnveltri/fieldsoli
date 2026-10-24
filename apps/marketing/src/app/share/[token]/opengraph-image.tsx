import { ImageResponse } from "next/og";

import { loadSharedDocument } from "../../../lib/load-shared-document";
import {
  OUTAGE_DOCUMENT_MESSAGE,
  UNAVAILABLE_DOCUMENT_MESSAGE,
  shareCard,
} from "../../../lib/share-document";

export const dynamic = "force-dynamic";
export const alt = "Shared invoice or estimate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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
            fontSize: 40,
            padding: 64,
            textAlign: "center",
          }}
        >
          {document.status === "unavailable"
            ? UNAVAILABLE_DOCUMENT_MESSAGE
            : OUTAGE_DOCUMENT_MESSAGE}
        </div>
      ),
      { ...size, headers: { "Cache-Control": "private, no-store" } },
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
        <div style={{ display: "flex", fontSize: 32 }}>{card.typeLabel}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "block", fontSize: 56, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
            {card.businessName}
          </div>
          <div style={{ display: "block", color: "#525252", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
            {card.shortDescription}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 72 }}>{card.amount}</div>
        <div style={{ display: "flex", fontSize: 24, color: "#737373" }}>{card.issuedLabel}</div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "private, no-store" } },
  );
}
