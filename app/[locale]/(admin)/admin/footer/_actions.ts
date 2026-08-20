"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  footerEditPayloadSchema,
  type FooterEditPayload,
} from "@/lib/schemas/footer";

const FOOTER_ROLES = ["admin", "editor", "marketing"] as const;

export type SaveFooterResult =
  | { status: "ok"; message?: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * Replace-then-insert, exactly as `saveMegamenuTab` does.
 *
 * Why replace and not diff: the editor holds the whole footer in local state
 * and sends all of it on every save. Deleting and re-inserting is simpler than
 * tracking which rows are new/updated/removed, the row counts are small (<60),
 * and `on delete cascade` clears links when their column goes. The cost is
 * that ids change on every save — fine, because nothing outside the footer
 * references them.
 *
 * The cost that is NOT fine is silent Arabic loss, which is why every `_ar`
 * key is written explicitly below and why the schema makes them required. A
 * twin the payload omits is not a field left alone here; it is a field
 * deleted, and it is deleted in a language most people approving the PR
 * cannot read. Same trap `lib/forms/_actions.ts` documents for form copy.
 */
async function revalidateFooterPaths() {
  if (!isSupabaseConfigured) return;
  revalidatePath("/admin/footer");
  revalidateLocalised("/", "layout"); // every public page renders the footer
}

export async function saveFooter(
  rawPayload: unknown,
): Promise<SaveFooterResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(FOOTER_ROLES);

  const parsed = footerEditPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(
        issue.path.slice(0, 2).join(".") || issue.path[0] || "",
      );
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const payload: FooterEditPayload = parsed.data;
  const supabase = await createSupabaseServerClient();

  // 1) Settings — a singleton, so upsert onto whichever row exists.
  const { data: existing } = await supabase
    .from("footer_settings")
    .select("id")
    .maybeSingle();
  const settingsRow = {
    blurb: payload.settings.blurb,
    blurb_ar: payload.settings.blurb_ar,
    contact_heading: payload.settings.contact_heading,
    contact_heading_ar: payload.settings.contact_heading_ar,
    legal_line: payload.settings.legal_line,
    legal_line_ar: payload.settings.legal_line_ar,
  };
  let settingsId = existing?.id ?? null;
  if (settingsId) {
    const { error } = await supabase
      .from("footer_settings")
      .update(settingsRow)
      .eq("id", settingsId);
    if (error) return { status: "error", message: error.message };
  } else {
    const { data, error } = await supabase
      .from("footer_settings")
      .insert(settingsRow)
      .select("id")
      .single();
    if (error) return { status: "error", message: error.message };
    settingsId = data.id;
  }

  // 2) Wipe columns (links cascade), socials and contact entries.
  const [{ error: delCols }, { error: delSocials }, { error: delContact }] =
    await Promise.all([
      supabase.from("footer_columns").delete().not("id", "is", null),
      supabase.from("footer_socials").delete().not("id", "is", null),
      supabase.from("footer_contact_items").delete().not("id", "is", null),
    ]);
  if (delCols) return { status: "error", message: delCols.message };
  if (delSocials) return { status: "error", message: delSocials.message };
  if (delContact) return { status: "error", message: delContact.message };

  // 3) Columns. Positions are re-numbered from array order — the client's
  //    `position` field is advisory, the array is canonical. Numbered per
  //    KIND, because `links` and `legal` are two independent orderings.
  if (payload.columns.length > 0) {
    const perKind: Record<string, number> = {};
    const colRows = payload.columns.map((c) => {
      const position = perKind[c.kind] ?? 0;
      perKind[c.kind] = position + 1;
      return {
        kind: c.kind,
        position,
        heading: c.heading,
        heading_ar: c.heading_ar,
        is_visible: c.is_visible,
      };
    });
    const { data: insertedCols, error: insColsErr } = await supabase
      .from("footer_columns")
      .insert(colRows)
      .select("id, kind, position");
    if (insColsErr) return { status: "error", message: insColsErr.message };

    // Map inserted rows back to payload entries by (kind, position) — unique
    // within the table by construction, since we just numbered them.
    const colIdByKey = new Map<string, string>();
    for (const r of insertedCols ?? []) {
      colIdByKey.set(`${r.kind}::${r.position}`, r.id);
    }

    const linkRows: {
      column_id: string;
      position: number;
      label: string;
      label_ar: string | null;
      href: string;
    }[] = [];
    payload.columns.forEach((col, idx) => {
      const columnId = colIdByKey.get(`${col.kind}::${colRows[idx]!.position}`);
      if (!columnId) return;
      col.links.forEach((link, linkIdx) => {
        linkRows.push({
          column_id: columnId,
          position: linkIdx,
          label: link.label,
          label_ar: link.label_ar,
          href: link.href,
        });
      });
    });

    if (linkRows.length > 0) {
      const { error: insLinksErr } = await supabase
        .from("footer_links")
        .insert(linkRows);
      if (insLinksErr)
        return { status: "error", message: insLinksErr.message };
    }
  }

  // 4) Socials.
  if (payload.socials.length > 0) {
    const { error } = await supabase.from("footer_socials").insert(
      payload.socials.map((s, idx) => ({
        position: idx,
        label: s.label,
        href: s.href,
        is_visible: s.is_visible,
      })),
    );
    if (error) return { status: "error", message: error.message };
  }

  // 5) Contact entries.
  if (payload.contact.length > 0) {
    const { error } = await supabase.from("footer_contact_items").insert(
      payload.contact.map((c, idx) => ({
        position: idx,
        kind: c.kind,
        label: c.label,
        label_ar: c.label_ar,
        body: c.body,
        body_ar: c.body_ar,
        is_visible: c.is_visible,
      })),
    );
    if (error) return { status: "error", message: error.message };
  }

  await logAudit({
    action: "footer.save",
    target_kind: "page", // closest existing audit target kind
    // The footer has no natural id; the singleton settings row is the one
    // stable handle it has, so the log entry points at that.
    target_id: settingsId,
    before: null,
    after: {
      columns: payload.columns.length,
      links: payload.columns.reduce((n, c) => n + c.links.length, 0),
      socials: payload.socials.length,
      contact: payload.contact.length,
    },
  });

  await revalidateFooterPaths();
  return { status: "ok", message: "Saved." };
}
