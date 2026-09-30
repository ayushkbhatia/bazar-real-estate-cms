import type { Metadata } from "next";
import { cookies } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { asLocale } from "@/lib/i18n/locales";
import {
  draftReadyFiles,
  findLink,
  inviteContext,
  inviteOutcome,
  linkState,
  reuploadContext,
  sessionCookieName,
} from "@/lib/mortgage-requests/server/links";
import { createAdminClient } from "@/lib/supabase/admin";
import { CodeGate } from "./_components/code-gate";
import { InviteVerified } from "./_components/invite-verified";
import { LinkMessage } from "./_components/link-message";
import { ReuploadVerified } from "./_components/reupload-verified";

/**
 * W8 · A secure link (docs/mortgage/frontend/W8; SPEC §8): the re-upload a
 * reviewer asked for in C4, or the pre-approval invite sent from C6. Rendered
 * on the server from the token's hash: a link that can't be used says so and
 * shows nothing of the application; a usable one asks for the code, then
 * opens. The token is the URL, so the page sends no referrer, and the layout
 * keeps it out of search and out of any cache.
 */

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function SecureLinkPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(asLocale(locale));

  const db = createAdminClient();
  if (!db) return <LinkMessage state="unavailable" purpose={null} />;
  const link = await findLink(db, token);
  const jar = await cookies();
  const state = linkState(link, new Date(), link ? (jar.get(sessionCookieName(link.id))?.value ?? null) : null);

  if (!link || state === "unavailable" || state === "expired" || state === "locked") {
    return <LinkMessage state={state === "expired" || state === "locked" ? state : "unavailable"} purpose={link?.purpose ?? null} />;
  }
  if (state === "used") {
    const reference = link.purpose === "preapproval_invite" ? await inviteOutcome(db, link) : null;
    return <LinkMessage state="used" purpose={link.purpose} reference={reference} />;
  }
  if (state === "code") return <CodeGate token={token} purpose={link.purpose} />;

  const ready = await draftReadyFiles(db, link);
  if (link.purpose === "reupload") {
    return <ReuploadVerified token={token} context={await reuploadContext(db, link)} ready={ready} />;
  }
  return <InviteVerified token={token} context={await inviteContext(db, link)} ready={ready} />;
}
