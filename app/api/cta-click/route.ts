/**
 * Record a floating-CTA click.
 *
 * A `wa.me` link opens a 1:1 chat inside the visitor's own WhatsApp, on the
 * advisor's phone; a `mailto:` hands a draft to their mail client. Neither
 * ever touches Bazar's servers, so there is no way to CC the office on the
 * conversation and no way to see whether it happened. This endpoint is the
 * only recordkeeping available: the rail beacons here as the link opens.
 *
 * It writes `cta_clicks`, not `enquiries`. A click has no name and no person
 * behind it — one row per idle tap in the enquiries inbox would drown the real
 * leads and skew every response-time metric read off them. Promotion to an
 * enquiry stays a human decision.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLOATING_CTA_KINDS } from "@/lib/schemas/floating-cta";
import { uuidLike } from "@/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Every field is length-capped. The beacon is unauthenticated by necessity —
 * the visitor is anonymous — so the payload is treated as hostile: nothing is
 * echoed back, nothing is interpolated anywhere, and the row is a fixed shape
 * regardless of what arrives.
 */
const clickSchema = z.object({
  cta_id: uuidLike().nullable().catch(null),
  cta_key: z.string().min(1).max(40),
  kind: z.enum(FLOATING_CTA_KINDS),
  path: z.string().min(1).max(512),
  page_title: z.string().max(300).nullable().catch(null),
  locale: z.string().max(8).nullable().catch(null),
  destination: z.string().max(160).nullable().catch(null),
  source: z.enum(["advisor", "cta", "fallback"]).catch("cta"),
  advisor_id: uuidLike().nullable().catch(null),
  advisor_name: z.string().max(120).nullable().catch(null),
  property_id: uuidLike().nullable().catch(null),
  development_id: uuidLike().nullable().catch(null),
  context_ref: z.string().max(300).nullable().catch(null),
});

/** Beyond this the body is not a click, so don't spend a JSON parse on it. */
const MAX_BODY_BYTES = 4_096;

export async function POST(req: NextRequest) {
  // 204 on every outcome, success or not. The caller is a fire-and-forget
  // beacon that cannot act on a failure, and a distinguishable error response
  // would only tell a prober which payloads are interesting.
  const noContent = new NextResponse(null, { status: 204 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return noContent;

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return noContent;
    raw = JSON.parse(text);
  } catch {
    return noContent;
  }

  const parsed = clickSchema.safeParse(raw);
  if (!parsed.success) return noContent;

  // Service role because `cta_clicks` has no insert policy at all: an anon
  // INSERT grant would let anyone POST straight at PostgREST and forge the
  // office's attribution numbers. Routing through here means the row is
  // validated and shaped server-side.
  const supabase = createAdminClient();
  if (!supabase) return noContent;

  const { error } = await supabase.from("cta_clicks").insert(parsed.data);
  if (error) console.error("[cta-click]", error.message);

  return noContent;
}
