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
         * `/ar` is disallowed while the Arabic site is under review.
         *
         * The pages carry `robots: noindex` too. Both, because they fail
         * differently: a `noindex` meta tag requires the crawler to fetch and
         * parse the page to learn it, and this is a whole locale tree of
         * machine-generated copy that no human has read yet. Removing these
         * two lines is the Arabic launch.
         */
        disallow: ["/admin", "/account", "/api", "/ar"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
