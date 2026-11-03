import { describe, expect, it } from "vitest";
import pages from "../../content/approved-pages.json";

describe("approved public marketing content", () => {
  it("contains no prototype scripts, credentials, or indexing directives in injected HTML", () => {
    for (const page of Object.values(pages)) {
      expect(page.html).not.toMatch(/<script|<meta|<iframe|\son\w+\s*=|supabase\.co|access_token|refresh_token/i);
    }
  });
  it("keeps the three approved guides distinct from service-route names", () => {
    expect(Object.keys(pages).sort()).toEqual(["estimates-invoices-payments", "free-vs-paid-contractor-software", "home", "job-records"]);
  });
});
