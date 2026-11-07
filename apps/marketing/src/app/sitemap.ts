import type { MetadataRoute } from "next";
import pages from "../content/approved-pages.json";
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://fieldsoli.com/" }, ...["support", "privacy", "terms", "delete-account"].map(path => ({ url: `https://fieldsoli.com/${path}` })), ...Object.keys(pages).filter(key => key !== "home").map(slug => ({ url: `https://fieldsoli.com/guides/${slug}` }))];
}
