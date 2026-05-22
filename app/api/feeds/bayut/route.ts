/**
 * Sprint 13 — Bayut XML feed (pull-based).
 *
 * Same shape as Property Finder; different tag names. Token verified
 * via BAYUT_FEED_TOKEN env.
 */

import { type NextRequest } from "next/server";
import { renderBayutFeed, verifyBayutToken } from "@/lib/syndication/bayut";
import { loadFeedProperties } from "@/lib/syndication/load";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!verifyBayutToken(token)) {
    return new Response("forbidden", { status: 403 });
  }
  const items = await loadFeedProperties();
  const body = renderBayutFeed(items);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}
