import { NextResponse, type NextRequest } from "next/server";
import { unsubscribeNewsletterToken } from "@/app/[locale]/(public)/_actions/newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe (RFC 8058) — where a newsletter's
 * `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header sends a mail
 * client's "Unsubscribe" button. The client POSTs to the URL in
 * `List-Unsubscribe` with `List-Unsubscribe=One-Click` in the body; the token
 * in the URL is the authorisation, as it is on the unsubscribe page.
 *
 * POST only, deliberately: link scanners and prefetchers issue GETs, and a GET
 * that unsubscribed would remove people who never asked to go.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = await unsubscribeNewsletterToken(token);
  if (result.status === "error") {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  // A token that matches nobody is answered like a success: the address is
  // not on the list either way, and the answer must not confirm which tokens
  // exist.
  return NextResponse.json({ ok: true });
}
