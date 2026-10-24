import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocumentPayload } from "@fieldsolo/document-renderer";

import { loadSharedDocument } from "./load-shared-document";
import { generateMetadata } from "../app/share/[token]/page";

vi.mock("./load-shared-document", () => ({ loadSharedDocument: vi.fn() }));

const payload: DocumentPayload = {
  schemaVersion: 1, documentType: "invoice", documentNumber: 42,
  businessName: "North & Co", businessAddress: null, businessPhone: null,
  businessEmail: null, businessWebsite: null, businessLicense: null,
  customerName: "Private Customer", customerPhone: "3125550199", customerEmail: "private@example.test",
  serviceAddress: "Private street", shortDescription: "Repair the porch", longDescription: "Private notes",
  lines: [], subtotalCents: 123400, taxRateBps: 0, taxCents: 0, totalCents: 123400,
  currency: "USD", issueDate: "2026-10-22", validUntil: null, dueDate: null, paymentTerms: null,
};
const props = { params: Promise.resolve({ token: "synthetic-token" }) };

afterEach(() => vi.resetAllMocks());

describe("shared document metadata", () => {
  it("uses business, document type, immutable amount and job title without inherited marketing branding", async () => {
    vi.mocked(loadSharedDocument).mockResolvedValue({ status: "ok", rendererVersion: 1, paymentProjection: "paid", payload });
    const metadata = await generateMetadata(props);
    expect(metadata.title).toEqual({ absolute: "Invoice from North & Co — $1,234.00" });
    expect(metadata.description).toBe("Repair the porch");
    expect(metadata.openGraph).toEqual({ title: "Invoice from North & Co — $1,234.00", description: "Repair the porch", siteName: "North & Co" });
    expect(JSON.stringify(metadata)).not.toMatch(/Private|private@example|3125550199|00042|synthetic-token|paid/i);
  });

  it("uses identical neutral metadata for all unavailable links, even with stale payload in the response", async () => {
    vi.mocked(loadSharedDocument).mockResolvedValue({ status: "unavailable", payload } as never);
    const metadata = await generateMetadata(props);
    expect(metadata.title).toEqual({ absolute: "Invoice/Estimate no longer exists." });
    expect(metadata.description).toBe("Invoice/Estimate no longer exists.");
    expect(metadata.robots).toEqual({ index: false, follow: false, noarchive: true });
    expect(JSON.stringify(metadata)).not.toMatch(/North|Private|FieldSoli|Repair/);
  });

  it("does not describe an outage as a nonexistent document", async () => {
    vi.mocked(loadSharedDocument).mockResolvedValue({ status: "outage" });
    const metadata = await generateMetadata(props);
    expect(metadata.description).toBe("This document is temporarily unavailable. Please try again.");
    expect(JSON.stringify(metadata)).not.toContain("no longer exists");
  });
});
