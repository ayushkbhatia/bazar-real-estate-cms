"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  parseStoredSections,
  validateSections,
  type StoredSection,
} from "@/lib/master-pages";
import {
  CARD_SOURCES,
  cardPageDef,
  getCard,
  releaseCardOverrides,
  spliceCardSection,
  type CardDef,
  type CardSourceKey,
} from "@/lib/master-pages/cards";
import { subPageSlug } from "@/lib/master-pages/subpages";
import {
  cardSourceSlug,
  getCardContent,
  listCardProjects,
} from "@/lib/queries/cards";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type CardResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

const SOURCE_TITLES: Record<CardSourceKey, string> = {
  "development-copy": "Project pages (shared copy)",
  "property-copy": "Property pages (shared copy)",
};

/**
 * Invalidate every page that reads a source document — the same set its own
 * screen invalidates, because it is the same document. A card that named only
 * one project would leave the rest serving the previous wording until their
 * own window rolled over, which reads as "the save did nothing".
 */
function revalidateSource(source: CardSourceKey): void {
  if (source === "development-copy") {
    revalidateLocalised("/developments");
    revalidateLocalised("/developments/[slug]", "page");
    revalidateLocalised("/off-plan/[slug]", "page");
    revalidatePath("/admin/pages/sub/development/copy");
  } else {
    revalidateLocalised("/p/[slug]", "page");
    revalidatePath("/admin/pages/sub/property");
  }
}

// Spelled as literals: `lib/i18n/revalidate.test.ts` can only tell an admin
// path from a public one when it can read it.
function revalidateCardScreens(card: CardDef): void {
  revalidatePath(`/admin/pages/cards/${card.key}`);
  revalidatePath("/admin/pages/cards");
}

/**
 * Write one section into its source document, keeping every other section.
 *
 * Read-modify-write on one row. The window between the read and the write is
 * the same one the document's own screen has between loading and saving, and
 * it resolves the same way — last write wins — so this adds no new race.
 */
async function writeCardSection(
  card: CardDef,
  section: StoredSection,
  action: string,
): Promise<CardResult> {
  const supabase = await createSupabaseServerClient();
  const slug = cardSourceSlug(card.source);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id, blocks")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const blocks = spliceCardSection(
    CARD_SOURCES[card.source].def(),
    parseStoredSections(existing?.blocks ?? null),
    section,
  );

  const payload = {
    slug,
    title: SOURCE_TITLES[card.source],
    status: "published" as const,
    blocks: blocks as unknown as never,
  };

  const write = existing
    ? await supabase
        .from("pages")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("pages").insert(payload).select("id").maybeSingle();

  if (write.error) return { status: "error", message: write.error.message };
  if (!write.data)
    return {
      status: "error",
      message:
        "Not saved — your account may not have permission to edit pages.",
    };

  await logAudit({
    action,
    target_kind: "page",
    target_id: write.data.id,
    before: null,
    after: { card: card.key, section: card.sectionKey },
  });

  revalidateSource(card.source);
  revalidateCardScreens(card);
  return { status: "ok", message: "Saved." };
}

export async function saveCard(
  key: string,
  sections: StoredSection[],
): Promise<CardResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const card = getCard(key);
  if (!card) return { status: "error", message: "Unknown card." };

  const incoming = sections.find((s) => s.key === card.sectionKey);
  if (!incoming) return { status: "error", message: "Nothing to save." };

  const result = validateSections(cardPageDef(card), [incoming]);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map((i) => `${i.field}: ${i.message}`),
    };
  }
  return writeCardSection(card, result.sections[0], "page.card_update");
}

/**
 * Back to the shipped wording — for this card only. The rest of the document
 * is left as it is; resetting it is the document's own screen's job.
 *
 * Written EMPTY rather than as a copy of today's defaults, so a later change
 * to the shipped wording reaches it.
 */
export async function resetCard(key: string): Promise<CardResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const card = getCard(key);
  if (!card) return { status: "error", message: "Unknown card." };

  return writeCardSection(
    card,
    { key: card.sectionKey, enabled: true, values: {} },
    "page.card_reset",
  );
}

/**
 * Hand every override that matches the card word for word back to the card.
 *
 * Only those: a project whose wording DIFFERS chose it, and clearing that
 * would change a live page behind the editor's back. For a matching one
 * nothing a visitor reads in English moves, and from then on an edit to the
 * card reaches that project too — which is what the card promises and, for
 * the 22 projects that predate it, has not been true.
 *
 * The comparison is re-run here against the card as stored now, not trusted
 * from the screen, so a card edited in another tab since the report loaded
 * cannot turn a "matches" into a silent change.
 */
export async function releaseMatchingOverrides(
  key: string,
): Promise<CardResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const card = getCard(key);
  if (!card || card.overriddenBy !== "development")
    return {
      status: "error",
      message: "This card has no overrides to release.",
    };

  const content = await getCardContent(card);
  const projects = await listCardProjects(card, content.values);
  const targets = projects
    .map((p) => ({
      slug: p.slug,
      fields: p.overrides.filter((o) => o.matchesCard).map((o) => o.field),
    }))
    .filter((t) => t.fields.length > 0);

  if (targets.length === 0)
    return {
      status: "ok",
      message: "Nothing to release — no project matches the card.",
    };

  const supabase = await createSupabaseServerClient();
  let released = 0;
  let fieldCount = 0;
  const failures: string[] = [];

  for (const target of targets) {
    const slug = subPageSlug("development", target.slug);
    const { data, error } = await supabase
      .from("pages")
      .select("id, blocks")
      .eq("slug", slug)
      .maybeSingle();
    const stored = parseStoredSections(data?.blocks ?? null);
    if (error || !data || !stored) {
      failures.push(target.slug);
      continue;
    }

    const blocks = stored.map((s) =>
      s.key === card.sectionKey
        ? { ...s, values: releaseCardOverrides(s.values, target.fields) }
        : s,
    );
    const write = await supabase
      .from("pages")
      .update({ blocks: blocks as unknown as never })
      .eq("id", data.id)
      .select("id")
      .maybeSingle();
    if (write.error || !write.data) {
      failures.push(target.slug);
      continue;
    }

    await logAudit({
      action: "page.card_release_overrides",
      target_kind: "page",
      target_id: data.id,
      before: null,
      after: { card: card.key, project: target.slug, fields: target.fields },
    });
    revalidateLocalised(`/developments/${target.slug}`);
    revalidateLocalised(`/off-plan/${target.slug}`);
    revalidatePath(`/admin/pages/sub/development/${target.slug}`);
    released += 1;
    fieldCount += target.fields.length;
  }

  revalidateCardScreens(card);

  if (failures.length > 0) {
    return {
      status: "error",
      message: `Released ${fieldCount} field${fieldCount === 1 ? "" : "s"} on ${released} project${released === 1 ? "" : "s"}; could not update ${failures.join(", ")}.`,
    };
  }
  return {
    status: "ok",
    message: `Handed ${fieldCount} field${fieldCount === 1 ? "" : "s"} on ${released} project${released === 1 ? "" : "s"} back to the card.`,
  };
}
