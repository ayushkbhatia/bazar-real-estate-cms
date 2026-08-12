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
    // How long the optimizer keeps an optimized variant before going back to
    // Supabase Storage for the original. Every one of those refetches is
    // billed as Supabase Cached Egress (Smart CDN), and the originals in the
    // `media` bucket average ~1.4 MB, so a short TTL is expensive: the org
    // blew its 5 GB/cycle cached-egress quota on the free plan. 31 days is
    // safe because the URL contains the storage object path — replacing an
    // asset means a new path, which misses the cache and re-optimizes.
    minimumCacheTTL: 2678400,
    // Next 16 allowlists `quality`: anything not in this array is a 400 from
    // the optimizer, so `quality={100}` needs the value declared here.
    //
    // 75 stays the default for photography, where the WebP artefacts land in
    // texture nobody reads. Floor plans are the opposite — hairline walls and
    // 10px dimension labels, which q75 smears (measured 38 dB PSNR against the
    // source, and the ringing is visible at 1:1). 100 is for those.
    qualities: [75, 100],
  },
  experimental: {
    // The root layout is `app/[locale]/layout.tsx`, a top-level dynamic
    // segment, so a URL that matches no route (`/fr/buy`, a typo'd path) has
    // no locale to resolve and therefore no layout to render `not-found.tsx`
    // into. Next names this exact case as the reason `global-not-found`
    // exists. Serves `app/global-not-found.tsx`.
    globalNotFound: true,
    serverActions: {
      // No file bytes travel through a server action any more — uploads go
      // browser → Supabase Storage on a signed URL (app/(admin)/admin/media/
      // _upload-actions.ts). This is headroom for large JSON payloads (page
      // section trees), and it is deliberately under Vercel's own 4.5 MB
      // request-body cap: a limit above that is fiction in production and only
      // hides the failure until deploy.
      bodySizeLimit: "4mb",
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
