import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const pageSource = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");

describe("website account deletion instructions", () => {
  it("uses the shared legal-page presentation", () => {
    expect(pageSource).toContain('import styles from "../legal.module.css"');
    expect(pageSource).toContain("className={styles.policy}");
  });

  it("links to the canonical legal sources", () => {
    expect(pageSource).toContain('<Link href="/privacy">Privacy Policy</Link>');
    expect(pageSource).toContain('<Link href="/terms">Terms of Service</Link>');
    expect(pageSource).toContain("is the source of truth");
  });

  it("matches the current in-app deletion flow and external request method", () => {
    expect(pageSource).toContain("<strong>Account</strong>");
    expect(pageSource).toContain("<strong>Privacy Choices</strong>");
    expect(pageSource).toContain("below Legal");
    expect(pageSource).toContain("Type <strong>delete account</strong>");
    expect(pageSource).toContain("Confirm the final deletion prompt");
    expect(pageSource).toContain("privacy@fieldsoli.com");
  });
});
