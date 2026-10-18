import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const redeemUrl = process.env.NEXT_PUBLIC_SUPABASE_REDEEM_JOB_EXPORT_URL?.trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const endpointUrl = redeemUrl || supabaseUrl;
    let redeemOrigin = "https://*.supabase.co";

    if (endpointUrl) {
      try {
        redeemOrigin = new URL(endpointUrl).origin;
      } catch {
        // Keep the safe, hosted-Supabase fallback for malformed local config.
      }
    }

    return [
      {
        source: "/share/:token*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'none'",
              "base-uri 'none'",
              "form-action 'none'",
              "frame-ancestors 'none'",
              "img-src 'self'",
              "style-src 'unsafe-inline'",
              "script-src 'self' 'unsafe-inline'",
              "connect-src 'none'",
              "font-src 'none'",
              "object-src 'none'",
              "worker-src 'none'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/exports/download",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'none'",
              "base-uri 'none'",
              "form-action 'none'",
              "frame-ancestors 'none'",
              "img-src 'self'",
              "style-src 'self' 'unsafe-inline'",
              // Next's App Router emits small inline bootstrap scripts for the
              // client component. Keep the policy scoped to this route and
              // disallow every external script origin.
              "script-src 'self' 'unsafe-inline'",
              `connect-src ${redeemOrigin}`,
              "font-src 'none'",
              "object-src 'none'",
              "worker-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
