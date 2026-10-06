import {
  renderDocument,
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

export function shareDocumentHtml(document: SharedDocument): string {
  if (document.status === "unavailable") {
    return pageShell("This document is unavailable.", "This document is unavailable.");
  }
  if (document.status === "outage") {
    return pageShell(
      "This document is temporarily unavailable. Please try again.",
      "This document is temporarily unavailable. Please try again.",
    );
  }
  if (document.rendererVersion !== 1) return unsupportedRendererHtml();
  return renderDocument(document.rendererVersion, document.payload, document.paymentProjection);
}

export function shareCard(document: Extract<SharedDocument, { status: "ok" }>) {
  const typeLabel = document.payload.documentType === "estimate" ? "Estimate" : "Invoice";
  const number = String(document.payload.documentNumber ?? 0).padStart(5, "0");
  return {
    title: `${typeLabel} from ${document.payload.businessName}`,
    businessName: document.payload.businessName,
    typeNumber: `${typeLabel} #${number}`,
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

function pageShell(title: string, message: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="robots" content="noindex,nofollow" /><title>${title}</title></head><body><article><h1>${message}</h1></article></body></html>`;
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
