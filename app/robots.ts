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
         * Arabic is indexed like English (launched 23 Oct 2026). Until then
         * this list carried `/ar/` and `/ar$` to hide the machine-drafted
         * Arabic tree while the client reviewed it (ADR-0008).
         *
         * A Disallow is a PREFIX, not a path segment. The first version of
         * that rule was a bare `/ar`, which also matched `/areas` — and under
         * RFC 9309 the longest matching rule wins, so it beat the `Allow: /`
         * above and took the whole area-guide tree out of Google's index.
         *
         * The three below are prefixes on purpose and collide with nothing:
         * no public route begins with `/admin`, `/account` or `/api`. Check
         * before adding a short one; robots.test.ts walks the route tree.
         */
        disallow: ["/admin", "/account", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
