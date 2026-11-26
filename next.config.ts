import type { NextConfig } from "next";

// Basic browser protections for every page. No Content-Security-Policy yet:
// Next.js inline scripts would need nonces, which turn off static rendering.
const securityHeaders = [
  // Nobody can frame the app (stops "click Approve" tricks from another site).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera only for this site (QR scanning arrives in week 3).
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
