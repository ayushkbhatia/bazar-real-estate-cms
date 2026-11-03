import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSender } from "@/lib/email";
import { resolveNewsletterSender, type NewsletterSender, type NewsletterSenderSettings } from "./sender";

/** The stored row, or null when there is none (or it can't be read). */
export async function readNewsletterSenderSettings(): Promise<NewsletterSenderSettings | null> {
  const client = createAdminClient();
  if (!client) return null;
  const { data, error } = await client
    .from("newsletter_settings")
    .select("from_name, from_address, reply_to")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    console.warn("[newsletter] sender settings unreadable, using the env sender:", error.message);
    return null;
  }
  return data;
}

/**
 * The From and Reply-To every newsletter carries — the send, the test and the
 * preview's inbox header all ask here, so none can claim a sender the others
 * won't use. Read with the service role: the sender runs from a cron with no
 * signed-in user.
 */
export async function readNewsletterSender(): Promise<NewsletterSender> {
  return resolveNewsletterSender(await readNewsletterSenderSettings(), emailSender());
}
