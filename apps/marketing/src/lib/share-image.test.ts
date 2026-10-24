import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import type { DocumentPayload } from "@fieldsolo/document-renderer";

import { loadSharedDocument } from "./load-shared-document";
import ShareCardImage from "../app/share/[token]/opengraph-image";

vi.mock("./load-shared-document", () => ({ loadSharedDocument: vi.fn() }));
vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(readonly element: ReactElement, readonly options: { headers: Record<string, string> }) {}
  },
}));

const payload = {
  issueDate: "2026-10-24", documentType: "estimate", documentNumber: 123, businessName: "A very long business name ".repeat(12),
  shortDescription: "Job title ".repeat(40), totalCents: 123456,
  customerName: "Private Customer", customerEmail: "private@example.test", serviceAddress: "Private address",
  longDescription: "Private notes",
} as DocumentPayload;
const props = { params: Promise.resolve({ token: "synthetic-token" }) };
const inspect = (response: unknown) => {
  const image = response as { element: ReactElement; options: { headers: Record<string, string> } };
  return { html: renderToStaticMarkup(image.element), headers: image.options.headers };
};

afterEach(() => vi.resetAllMocks());

describe("shared document image", () => {
  it.each(["estimate", "invoice"] as const)("shows the %s issue date beneath bounded business/job text and amount", async (documentType) => {
    vi.mocked(loadSharedDocument).mockResolvedValue({ status: "ok", rendererVersion: 1, paymentProjection: null, payload: { ...payload, documentType } });
    const { html, headers } = inspect(await ShareCardImage(props));
    expect(html).toContain(documentType === "estimate" ? "Estimate" : "Invoice");
    expect(html).toContain("$1,234.56");
    expect(html).toContain(payload.businessName);
    expect(html).toContain(payload.shortDescription);
    expect(html.match(/text-overflow:ellipsis/g)).toHaveLength(2);
    expect(html).toContain('font-size:24px;color:#737373">Issued October 24, 2026');
    expect(html).not.toMatch(/Private|private@example|000123|synthetic-token|Shared with FieldSoli/);
    expect(headers["Cache-Control"]).toBe("private, no-store");
  });

  it("returns a neutral image after revocation even if stale payload fields are supplied", async () => {
    vi.mocked(loadSharedDocument).mockResolvedValue({ status: "unavailable", payload } as never);
    const { html, headers } = inspect(await ShareCardImage(props));
    expect(html).toContain("Invoice/Estimate no longer exists.");
    expect(html).not.toMatch(/Private|business name|Job title|FieldSoli|1,234/);
    expect(headers["Cache-Control"]).toBe("private, no-store");
  });
});
