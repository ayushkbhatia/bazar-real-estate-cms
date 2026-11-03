"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { NEWSLETTER_SEND_ROLES } from "@/lib/newsletter/campaign";
import { contactsToCsv, isValidEmail, localeOf, normaliseEmail, parseContacts } from "@/lib/newsletter/lists";
import { emailHash } from "@/lib/newsletter/send";

/**
 * Custom recipient lists (0176). Admin and marketing only — the people who
 * may send — enforced here and by RLS. Addresses never reach a log or the
 * audit trail: an import is recorded by its counts.
 */

export type ListActionResult =
  | { status: "ok"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

const PATH = "/admin/newsletter/lists";
const MAX_CSV_BYTES = 5 * 1024 * 1024;

const listSchema = z.object({
  name: z.string().trim().min(1, "Give the list a name.").max(120, "Keep the name under 120 characters."),
  description: z.string().trim().max(400, "Keep the description under 400 characters."),
});

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function createList(raw: unknown): Promise<ListActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await supabase
    .from("newsletter_lists")
    .insert({ ...parsed.data, created_by: user.id, updated_by: user.id })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: error?.message ?? "Could not create the list." };
  await logAudit({ action: "newsletter.list_create", target_kind: "newsletter_list", target_id: data.id, after: { name: parsed.data.name } });
  revalidatePath("/admin/newsletter/lists");
  redirect(`${PATH}/${data.id}`);
}

export async function updateList(id: string, raw: unknown): Promise<ListActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await supabase
    .from("newsletter_lists")
    .update({ ...parsed.data, updated_by: user.id })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "That list no longer exists." };
  revalidatePath(`/admin/newsletter/lists/${id}`);
  return { status: "ok", message: "Saved." };
}

/**
 * Delete a list and every address on it. A sent campaign's report keeps its
 * totals; its delivery rows for these contacts go with them (they hold no
 * address, but nor would they mean anything). Suppressions stay.
 */
export async function deleteList(id: string): Promise<ListActionResult> {
  const { supabase } = await requireRole(NEWSLETTER_SEND_ROLES);
  const { count } = await supabase.from("newsletter_list_contacts").select("id", { count: "exact", head: true }).eq("list_id", id);
  const { data, error } = await supabase.from("newsletter_lists").delete().eq("id", id).select("id, name").maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "That list no longer exists." };
  await logAudit({ action: "newsletter.list_delete", target_kind: "newsletter_list", target_id: id, before: { name: data.name, contacts: count ?? 0 } });
  revalidatePath("/admin/newsletter/lists");
  redirect(PATH);
}

export type ImportReport = {
  added: number;
  alreadyOnList: number;
  suppressed: number;
  invalid: number;
  duplicates: number;
  truncated: number;
};

/**
 * Add a CSV's contacts to a list. The file is parsed again here — the
 * browser's preview is a courtesy — and every address that ever unsubscribed
 * or hard-bounced, here or on any list, is left out. Re-importing never
 * brings a removed contact back: an address already on the list is left as
 * it is.
 */
export async function importContacts(
  listId: string,
  csv: string,
  consent: boolean,
): Promise<{ status: "ok"; message: string; report: ImportReport } | { status: "error"; message: string }> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  if (!consent) {
    return { status: "error", message: "Confirm that everyone on the list agreed to hear from Bazar before importing it." };
  }
  if (typeof csv !== "string" || csv.length === 0) return { status: "error", message: "The file is empty." };
  if (csv.length > MAX_CSV_BYTES) return { status: "error", message: "Keep the file under 5 MB — split a bigger list in two." };
  const { data: list } = await supabase.from("newsletter_lists").select("id").eq("id", listId).maybeSingle();
  if (!list) return { status: "error", message: "That list no longer exists." };

  const parsed = parseContacts(csv);
  if (parsed.contacts.length === 0) {
    return { status: "error", message: "No email addresses found. The file needs a column of addresses — headed “email”, or on its own." };
  }

  // Suppressed addresses, looked up by hash, 500 at a time.
  const suppressed = new Set<string>();
  const hashes = parsed.contacts.map((c) => emailHash(c.email));
  for (let i = 0; i < hashes.length; i += 500) {
    const { data, error } = await supabase.from("newsletter_suppressions").select("email_hash").in("email_hash", hashes.slice(i, i + 500));
    if (error) return { status: "error", message: error.message };
    for (const r of data ?? []) suppressed.add(r.email_hash);
  }
  const keep = parsed.contacts.filter((c) => !suppressed.has(emailHash(c.email)));

  let added = 0;
  for (let i = 0; i < keep.length; i += 500) {
    const rows = keep.slice(i, i + 500).map((c) => ({ ...c, list_id: listId, source: "upload", added_by: user.id }));
    const { data, error } = await supabase
      .from("newsletter_list_contacts")
      .upsert(rows, { onConflict: "list_id,email", ignoreDuplicates: true })
      .select("id");
    if (error) return { status: "error", message: `Stopped after ${added} added: ${error.message}` };
    added += data?.length ?? 0;
  }

  const report: ImportReport = {
    added,
    alreadyOnList: keep.length - added,
    suppressed: parsed.contacts.length - keep.length,
    invalid: parsed.invalid.length,
    duplicates: parsed.duplicates,
    truncated: parsed.truncated,
  };
  await logAudit({ action: "newsletter.list_import", target_kind: "newsletter_list", target_id: listId, after: report });
  revalidatePath(`/admin/newsletter/lists/${listId}`);
  revalidatePath("/admin/newsletter/lists");
  const parts = [
    `${added} added`,
    report.alreadyOnList ? `${report.alreadyOnList} already on the list` : "",
    report.suppressed ? `${report.suppressed} left out — they unsubscribed or bounced before` : "",
    report.invalid ? `${report.invalid} line${report.invalid === 1 ? " wasn't an email address" : "s weren't email addresses"}` : "",
  ].filter(Boolean);
  return { status: "ok", message: `${parts.join(", ")}.`, report };
}

const contactSchema = z.object({
  email: z.string().transform(normaliseEmail).refine(isValidEmail, "Enter an email address."),
  name: z.string().trim().max(120),
  locale: z.string().transform((v) => localeOf(v)),
});

/** One address typed in by hand. */
export async function addContact(listId: string, raw: unknown): Promise<ListActionResult> {
  const { supabase, user } = await requireRole(NEWSLETTER_SEND_ROLES);
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) return { status: "error", message: "Fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const { data: blocked } = await supabase
    .from("newsletter_suppressions")
    .select("reason")
    .eq("email_hash", emailHash(parsed.data.email))
    .maybeSingle();
  if (blocked) {
    return {
      status: "error",
      message: `That address ${blocked.reason === "bounced" ? "bounced" : "unsubscribed"} before, so it can't be added. They can sign up again on the site.`,
    };
  }
  const { error } = await supabase
    .from("newsletter_list_contacts")
    .insert({ ...parsed.data, list_id: listId, source: "manual", added_by: user.id });
  if (error) {
    if (error.code === "23505") return { status: "error", message: "That address is already on the list." };
    return { status: "error", message: error.message };
  }
  await logAudit({ action: "newsletter.list_contact_add", target_kind: "newsletter_list", target_id: listId });
  revalidatePath(`/admin/newsletter/lists/${listId}`);
  return { status: "ok", message: "Added." };
}

/** Take an address off this list (it can be added again). */
export async function removeContact(listId: string, contactId: string): Promise<ListActionResult> {
  const { supabase } = await requireRole(NEWSLETTER_SEND_ROLES);
  const { data, error } = await supabase
    .from("newsletter_list_contacts")
    .delete()
    .eq("id", contactId)
    .eq("list_id", listId)
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Already removed." };
  await logAudit({ action: "newsletter.list_contact_remove", target_kind: "newsletter_list", target_id: listId });
  revalidatePath(`/admin/newsletter/lists/${listId}`);
  return { status: "ok", message: "Removed from the list." };
}

/**
 * Someone asked by other means to stop: unsubscribed here, which suppresses
 * the address on every list and ends any subscription (the 0176 trigger).
 */
export async function unsubscribeContact(listId: string, contactId: string): Promise<ListActionResult> {
  const { supabase } = await requireRole(NEWSLETTER_SEND_ROLES);
  const { data, error } = await supabase
    .from("newsletter_list_contacts")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("id", contactId)
    .eq("list_id", listId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();
  if (error) return { status: "error", message: error.message };
  if (!data) return { status: "error", message: "Already unsubscribed." };
  await logAudit({ action: "newsletter.list_contact_unsubscribe", target_kind: "newsletter_list", target_id: listId });
  revalidatePath(`/admin/newsletter/lists/${listId}`);
  return { status: "ok", message: "Unsubscribed — they won't receive anything from any list or the newsletter." };
}

/** The whole list as a CSV, for a download. Recorded, as an export of personal data. */
export async function exportList(listId: string): Promise<{ status: "ok"; csv: string; filename: string } | { status: "error"; message: string }> {
  const { supabase } = await requireRole(NEWSLETTER_SEND_ROLES);
  const { data: list } = await supabase.from("newsletter_lists").select("name").eq("id", listId).maybeSingle();
  if (!list) return { status: "error", message: "That list no longer exists." };
  const rows: { email: string; name: string; locale: string; status: string; created_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("newsletter_list_contacts")
      .select("email, name, locale, status, created_at")
      .eq("list_id", listId)
      .order("created_at")
      .order("id")
      .range(from, from + 999);
    if (error) return { status: "error", message: error.message };
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  await logAudit({ action: "newsletter.list_export", target_kind: "newsletter_list", target_id: listId, after: { contacts: rows.length } });
  const slug = list.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "list";
  return { status: "ok", csv: contactsToCsv(rows), filename: `${slug}-${new Date().toISOString().slice(0, 10)}.csv` };
}
