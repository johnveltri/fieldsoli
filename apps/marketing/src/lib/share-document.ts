import {
  renderDocument,
  formatUsd,
  unsupportedRendererHtml,
  type DocumentPayload,
  type PaymentProjection,
} from "@fieldsolo/document-renderer";

export type SharedDocument =
  | { status: "unavailable" }
  | { status: "outage" }
  | {
      status: "ok";
      rendererVersion: number;
      paymentProjection: PaymentProjection;
      payload: DocumentPayload;
    };

export const UNAVAILABLE_DOCUMENT_MESSAGE = "Invoice/Estimate no longer exists.";
export const OUTAGE_DOCUMENT_MESSAGE = "This document is temporarily unavailable. Please try again.";

export function shareDocumentHtml(document: SharedDocument): string {
  if (document.status === "unavailable") {
    return pageShell(UNAVAILABLE_DOCUMENT_MESSAGE, UNAVAILABLE_DOCUMENT_MESSAGE);
  }
  if (document.status === "outage") {
    return pageShell(
      OUTAGE_DOCUMENT_MESSAGE,
      OUTAGE_DOCUMENT_MESSAGE,
      true,
    );
  }
  if (document.rendererVersion !== 1) return unsupportedRendererHtml();
  return renderDocument(document.rendererVersion, document.payload, document.paymentProjection);
}

export function shareCard(document: Extract<SharedDocument, { status: "ok" }>) {
  const typeLabel = document.payload.documentType === "estimate" ? "Estimate" : "Invoice";
  const amount = formatUsd(document.payload.totalCents);
  return {
    title: `${typeLabel} from ${document.payload.businessName} — ${amount}`,
    businessName: document.payload.businessName,
    typeLabel,
    amount,
    shortDescription: document.payload.shortDescription,
    totalCents: document.payload.totalCents,
  };
}

export const SHARE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

function pageShell(title: string, message: string, retry = false): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="robots" content="noindex,nofollow" /><title>${title}</title><style>@font-face { font-family: FieldSoliUbuntu; src: url("/fonts/Ubuntu-Regular.ttf") format("truetype"); font-style: normal; font-weight: 400; font-display: swap; } .shared-document-message { font-family: FieldSoliUbuntu, "Ubuntu", ui-sans-serif, system-ui, sans-serif; font-size: 16px; font-weight: 400; line-height: 1.4; } .shared-document-message h1 { font: inherit; }</style></head><body><article class="shared-document-message"><h1>${message}</h1>${retry ? '<a href="">Retry</a>' : ''}</article></body></html>`;
}

export function parseResolveResult(value: unknown): SharedDocument {
  if (!value || typeof value !== "object") return { status: "outage" };
  const row = value as {
    status?: string;
    rendererVersion?: number;
    paymentProjection?: PaymentProjection;
    payload?: DocumentPayload;
  };
  if (row.status === "unavailable") return { status: "unavailable" };
  if (row.status !== "ok" || !row.payload || row.rendererVersion == null) {
    return { status: "outage" };
  }
  return {
    status: "ok",
    rendererVersion: row.rendererVersion,
    paymentProjection: row.paymentProjection ?? null,
    payload: row.payload,
  };
}
