import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  experimental: {
    serverActions: {
      // Allow image uploads through server actions (default 1MB is too small).
      bodySizeLimit: "12mb",
    },
  },
  // Sprint 13: portals expect `.xml` extensions in feed URLs. We host
  // the routes under cleaner segment names (no dots in folder names —
  // Next 16 chokes on those during build config) and rewrite the
  // .xml-suffixed URLs onto them.
  async rewrites() {
    return [
      {
        source: "/api/feeds/property-finder.xml",
        destination: "/api/feeds/property-finder",
      },
      {
        source: "/api/feeds/bayut.xml",
        destination: "/api/feeds/bayut",
      },
    ];
  },
};

export default nextConfig;
