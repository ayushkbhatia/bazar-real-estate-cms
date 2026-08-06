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
  // Client nav restructure: the areas index is back to "Areas" + /areas.
  // Permanent redirects keep the interim /communities links (brand footer,
  // bookmarks, backlinks, search results) resolving to the new path.
  async redirects() {
    return [
      // Customer accounts were removed. These paths were the customer auth
      // surface; anything still pointing at them — bookmarks, old emails,
      // lib/auth's anonymous fallback — lands on the staff door rather than
      // a 404, which is the only sign-in that still exists.
      {
        source: "/sign-in",
        destination: "/admin/login",
        permanent: true,
      },
      {
        source: "/sign-up",
        destination: "/admin/login",
        permanent: true,
      },
      {
        source: "/magic-link",
        destination: "/admin/login",
        permanent: true,
      },
      {
        source: "/reset-password",
        destination: "/admin/login",
        permanent: true,
      },
      {
        source: "/verify-otp",
        destination: "/admin/login",
        permanent: true,
      },
      {
        source: "/communities",
        destination: "/areas",
        permanent: true,
      },
      // The QR scan destination moved from /contact-us/qr to /contact-qr.
      // This redirect is what keeps any code already printed, displayed or
      // shared on the old URL working — a QR code cannot be re-issued once it
      // is on a card or a window, so this has to stay indefinitely.
      {
        source: "/contact-us/qr",
        destination: "/contact-qr",
        permanent: true,
      },
      // /contact-us itself never existed — the contact page is /contact — but
      // it reads like a real page and gets typed or guessed, and it was the
      // parent of the old QR path. Send it to /contact rather than 404.
      //
      // Exact match, so it does not swallow /contact-us/qr above; Next.js does
      // not treat `source` as a prefix. Order is irrelevant for two exact
      // sources, but the QR rule is first because it is the load-bearing one.
      {
        source: "/contact-us",
        destination: "/contact",
        permanent: true,
      },
      {
        source: "/communities/:slug*",
        destination: "/areas/:slug*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
