/**
 * Sprint 13 — Property Finder XML feed (pull-based).
 *
 * Portal fetches /api/feeds/property-finder.xml?token=<env-secret>
 * periodically and ingests new listings. Falls back to a public
 * (token-less) feed when PROPERTY_FINDER_FEED_TOKEN is unset so it
 * works out of the box in dev.
 */

import { type NextRequest } from "next/server";
import {
  renderPropertyFinderFeed,
  verifyPropertyFinderToken,
} from "@/lib/syndication/property-finder";
import { loadFeedProperties } from "@/lib/syndication/load";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!verifyPropertyFinderToken(token)) {
    return new Response("forbidden", { status: 403 });
  }
  const items = await loadFeedProperties();
  const body = renderPropertyFinderFeed(items);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
