import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { publicPageMetadata } from "./search-metadata";
import sitemap from "../app/sitemap";
import robots from "../app/robots";
const source = (file: string) => readFileSync(path.join(import.meta.dirname, "../app", file), "utf8");

describe("public indexing and private-service exclusion", () => {
  it("publishes consistent robots directives and final canonical URLs", () => {
    expect(publicPageMetadata("/guides/job-records/")).toEqual({
      alternates: { canonical: "https://fieldsoli.com/guides/job-records" },
      robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    });
    expect(publicPageMetadata("/").alternates?.canonical).toBe("https://fieldsoli.com/");
  });
  it("advertises only public informational URLs in the sitemap", () => {
    const urls = sitemap().map(item => item.url);
    expect(urls).toHaveLength(8);
    expect(urls).toContain("https://fieldsoli.com/support");
    expect(urls).toContain("https://fieldsoli.com/privacy");
    expect(urls).toContain("https://fieldsoli.com/terms");
    expect(urls).toContain("https://fieldsoli.com/delete-account");
    expect(urls.join(" ")).not.toMatch(/\/auth\/|\/share\/|\/exports\/|\/api\//);
    expect(robots().sitemap).toBe("https://fieldsoli.com/sitemap.xml");
  });
  it("defaults to noindex for all agents without changing private-link headers", () => {
    const layout = source("layout.tsx");
    expect(layout).not.toMatch(/\b(?:index|follow): true/);
    for (const file of ["share/[token]/page.tsx", "exports/download/page.tsx"]) {
      expect(source(file)).toContain("index: false");
      expect(source(file)).toContain("noarchive: true");
    }
    const config = readFileSync(path.join(import.meta.dirname, "../../next.config.ts"), "utf8");
    expect(config).toContain('value: "noindex, nofollow, noarchive"');
  });
});
