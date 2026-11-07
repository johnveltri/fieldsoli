import type { Metadata } from "next";

/** Only public informational pages opt in; service routes inherit noindex. */
export function publicPageMetadata(path: string): Pick<Metadata, "alternates" | "robots"> {
  const normalized = path === "/" ? "/" : path.replace(/\/+$/, "");
  return {
    alternates: { canonical: `https://fieldsoli.com${normalized}` },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  };
}
