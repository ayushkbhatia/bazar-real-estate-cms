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
  // the routes under cleaner segment names (no dots in folder names)
  // and rewrite the .xml-suffixed URLs onto them.
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
  // BF-6: /verify-otp was always a magic-link form (the path name implied
  // OTP entry but the action sends a magic link). Renamed to /magic-link;
  // permanent redirect from the legacy URL keeps emailed deep-links live.
  //
  // Client nav restructure: "Areas" renamed to "Communities" (label + URL).
  // Permanent redirects keep old /areas links (bookmarks, backlinks,
  // search results) resolving to the new path.
  async redirects() {
    return [
      {
        source: "/verify-otp",
        destination: "/magic-link",
        permanent: true,
      },
      {
        source: "/areas",
        destination: "/communities",
        permanent: true,
      },
      {
        source: "/areas/:slug*",
        destination: "/communities/:slug*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
