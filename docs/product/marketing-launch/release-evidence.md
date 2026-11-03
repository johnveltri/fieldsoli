# Approved marketing release

Source: owner-approved private prototype, commit `80baba5a1a978c7677d1c0d6c17ebe512a1b8fd0`. Ported as static server-rendered page content with page-scoped styles and small React menu/FAQ interactions. The main page and three guides preserve the approved composition. Legal/auth/service components continue to use the original app shell.

Public homepage and guides have index/follow metadata, production canonicals and a four-page sitemap. The global layout and all private-route robots/security headers are unchanged. Service links, Supabase configuration, environment values, email templates and redirect URLs are not changed. No private service routes are included in the sitemap.

The account-deletion instructions now point to Account → Help & Privacy → Privacy Choices → Delete Account, matching the current app. The actual deletion mechanism and email request method are unchanged.

## Verification

- Production Next.js build, marketing tests, document-renderer tests, edited-file ESLint, product export and design validation.
- Browser verification at 320/390/1280px: approved layout, ten FAQ interactions, mobile menu, all app-store images, three guides, no overflow, public metadata and sitemap.
- Legal/support/delete-account/auth-confirmation/password-reset/export pages return HTTP 200.
- Export and invalid shared-document surfaces retain noindex/noarchive, no-referrer, CSP and private caching headers.
- Export and shared-document automated tests cover bearer-fragment clearing, request shape, expiry/unavailable/outage behavior, invoice/estimate rendering, rich-preview privacy and analytics exclusion.
- Auth components, legal sources, shared/export implementation, backend configuration and environment values remain unchanged from the branch base. Local auth without credentials correctly fails closed.

A real emailed credential was not redeemed, an account was not deleted, and no private customer document/export link was used during QA. These limits must not be presented as full live end-to-end verification.

Production rollback reference: `https://fieldsolo-marketing-p3lz48i5y-veltri-ventures.vercel.app` (Ready before this release). Deployment uses remote production environment settings without downloading secrets. The blocked `vercel pull --environment=production` was not retried.

## Production outcome

- PR: https://github.com/johnveltri/fieldsoli/pull/114 — open, not merged.
- Deployed application source: `2bab154f76904a27e41b49470381f8650a9ee7a1`.
- Production deployment: `dpl_3s6sMtQ3KwugP6KjptNrtUoAUPqC`, https://fieldsolo-marketing-hkzcbe112-veltri-ventures.vercel.app.
- Promoted to https://fieldsoli.com on November 3, 2026, after all 15 staged route checks passed.
- Public-domain browser checks passed at 320/390/1280px and for all service routes. Live invalid shared-document RPC and social preview PNG respond correctly. Invalid export fragment is removed and fails closed; malformed waitlist request is rejected without a submission. Sign-in deep link remains present and password-reset page has configuration.
- The final documentation-only commit records this deployment; it does not require another application deployment.
