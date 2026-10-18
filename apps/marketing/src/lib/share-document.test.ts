import { describe, expect, it } from "vitest";

import type { DocumentPayload } from "@fieldsolo/document-renderer";

import { parseResolveResult, shareCard, shareDocumentHtml } from "./share-document";

const payload: DocumentPayload = {
  schemaVersion: 1,
  documentType: "estimate",
  documentNumber: 1,
  businessName: "North Co",
  businessAddress: null,
  businessPhone: null,
  businessEmail: null,
  businessWebsite: null,
  businessLicense: null,
  customerName: "Pat",
  customerPhone: "555",
  customerEmail: "pat@example.com",
  serviceAddress: "1 Main",
  shortDescription: "Valve",
  longDescription: "A long private description",
  lines: [{ kind: "labor", label: "Labor & Services", amountCents: 100 }],
  subtotalCents: 100,
  taxRateBps: 0,
  taxCents: 0,
  totalCents: 100,
  currency: "USD",
  issueDate: "2026-10-06",
  validUntil: null,
  dueDate: null,
  paymentTerms: null,
};

describe("share documents", () => {
  it("renders the same unavailable page for unknown and disabled tokens", () => {
    const html = shareDocumentHtml(parseResolveResult({ status: "unavailable" }));
    expect(html).toContain("This document is unavailable.");
    expect(html).not.toContain("Pat");
  });

  it("keeps the card to the approved short fields", () => {
    const card = shareCard({
      status: "ok",
      rendererVersion: 1,
      paymentProjection: null,
      payload,
    });
    expect(card.title).toBe("Estimate from North Co");
    expect(card.typeNumber).toBe("Estimate #00001");
    expect(card.shortDescription).toBe("Valve");
    expect(JSON.stringify(card)).not.toContain("long private");
    expect(JSON.stringify(card)).not.toContain("pat@example.com");
  });

  it("uses the shared renderer for an enabled document", () => {
    const html = shareDocumentHtml({
      status: "ok",
      rendererVersion: 1,
      paymentProjection: null,
      payload,
    });
    expect(html).toContain("Estimate #00001");
    expect(html).toContain("Valve");
  });
});
