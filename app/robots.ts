import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = (
    env.NEXT_PUBLIC_SITE_URL ?? "https://www.bazarrealestate.ae"
  ).replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        /*
         * The Arabic tree is disallowed while it is under review.
         *
         * The pages carry `robots: noindex` too. Both, because they fail
         * differently: a `noindex` meta tag requires the crawler to fetch and
         * parse the page to learn it, and this is a whole locale tree of
         * machine-generated copy that no human has read yet. Removing the two
         * `/ar` lines is the Arabic launch.
         *
         * They are written `/ar/` and `/ar$` rather than `/ar`, because a
         * Disallow is a PREFIX, not a path segment. A bare `/ar` also matches
         * `/areas` — and under RFC 9309 the longest matching rule wins, so it
         * beat the `Allow: /` above and took the whole area-guide tree out of
         * Google's index: /areas and all nineteen /areas/<slug> pages, none of
         * which carry noindex and all of which the sitemap advertises.
         *
         * `/ar/` covers the tree; `/ar$` end-anchors the locale root, which is
         * a real 200 page (`/ar/` 308s to it). Neither matches `/areas`.
         *
         * The other three are prefixes on purpose and collide with nothing:
         * no public route begins with `/admin`, `/account` or `/api`. Check
         * before adding a short one.
         */
        disallow: ["/admin", "/account", "/api", "/ar/", "/ar$"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
