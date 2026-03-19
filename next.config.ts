import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {},
  // Required for @anthropic-ai/sdk (Node.js crypto/stream modules)
  serverExternalPackages: ["@anthropic-ai/sdk", "plaid"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' https://*.plaid.com https://cdn.plaid.com",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com https://*.plaid.com",
              "style-src 'self' 'unsafe-inline'",
              // Add your CDN/storage domains to img-src as needed
              "img-src 'self' data: blob: https://*.supabase.co",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.plaid.com https://cdn.plaid.com",
              "frame-src 'self' https://*.plaid.com https://cdn.plaid.com",
              "worker-src 'self' blob: https://cdn.plaid.com https://*.plaid.com",
              "child-src 'self' https://*.plaid.com https://cdn.plaid.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ]
  },
}

export default nextConfig
