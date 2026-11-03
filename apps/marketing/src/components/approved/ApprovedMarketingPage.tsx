import pages from "../../content/approved-pages.json";
import { MarketingInteractions } from "./MarketingInteractions";

export type ApprovedPageKey = keyof typeof pages;
export const approvedPages = pages;

/** Owner-approved static content, checked into source; never accepts user HTML. */
export function ApprovedMarketingPage({ pageKey }: { pageKey: ApprovedPageKey }) {
  const page = pages[pageKey];
  const kind = pageKey === "home" ? "home" : "guide";
  return <>
    <link rel="stylesheet" href={`/approved/${kind === "home" ? "home" : "guides"}.css`} />
    {page.schema.map((value, index) => <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(value).replace(/</g, "\\u003c") }} />)}
    <div className={`approved-marketing approved-${kind}`} dangerouslySetInnerHTML={{ __html: page.html }} />
    <MarketingInteractions pageKey={pageKey} />
  </>;
}
