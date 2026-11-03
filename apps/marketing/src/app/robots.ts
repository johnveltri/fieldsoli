import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    sitemap: "https://fieldsoli.com/sitemap.xml",
    rules: {
      userAgent: "*",
    },
  };
}
