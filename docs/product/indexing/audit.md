# Live discovery audit and indexing-policy follow-up

Audited November 3, 2026. Homepage and all three guides are already eligible for indexing: HTTP 200, index/follow metadata, public canonicals, sitemap entries and no restrictive X-Robots-Tag. robots.txt advertises the sitemap and does not disallow crawlers. Basic Googlebot, Bingbot and OAI-SearchBot user-agent requests returned HTTP 200; this is not verification of requests from their real IP ranges or proof of indexing.

Found conflicting inherited metadata on support, privacy, terms, deletion help and both email-auth routes: generic noindex/nofollow versus Googlebot index/follow. The follow-up PR defaults all agents to noindex, explicitly opts public pages in, adds public support/legal/help URLs to the sitemap and aligns guide canonicals/Article identity with the final non-trailing-slash URLs.

Hosted invoices/estimates (`/share/[token]`) and exports remain noindex/nofollow/noarchive in metadata and HTTP headers. They remain reachable by recipients and preview services; robots.txt does not disallow fetching, allowing crawlers to read noindex. Noindex is a search directive, not authorization or confidentiality. Token lookup, authentication, email delivery/redirect settings and all private-link protections are unchanged.

This follow-up is a separate PR, not a production deployment. Existing homepage/guide discovery is already enabled on the live site. Actual indexing status requires Search Console URL Inspection, sitemap submission and crawler logs; these were not accessed. No promise of search ranking or AI recommendations is made.

References: https://developers.google.com/search/docs/crawling-indexing/robots/intro and https://developers.openai.com/api/docs/bots.
