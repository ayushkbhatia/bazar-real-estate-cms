"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  listAmenitiesTaxonomyForAdmin,
  upsertAmenityTaxonomyEntry,
} from "@/lib/queries/amenities-taxonomy";
import {
  amenityTaxonomyEntrySchema,
  AMENITY_CATEGORIES,
  type AmenityTaxonomyEntry,
} from "@/lib/schemas/amenity-taxonomy";
import {
  amenityCodeFromLabel,
  MAX_AMENITY_LENGTH,
  type AmenityOption,
} from "@/lib/amenities";

/**
 * Promote an amenity typed in the picker into the taxonomy.
 *
 * Before this, a lister who needed "Wine cellar" got a free-text value on that
 * one listing: it printed on the property page, it was not a search filter,
 * and — the reason this exists — it had nowhere to hold Arabic, because the
 * only place Arabic lives for an amenity is `amenities_taxonomy.label_ar`.
 * Fifty-five such values are sitting in the live catalogue today, each one a
 * word that renders English on `/ar` for ever.
 *
 * So the picker writes the vocabulary now, not just the listing. The row lands
 * active, in the category the lister chose, with whatever Arabic they typed —
 * and if they typed none, it shows up under "Needs Arabic" at
 * /admin/settings/fields for the pass that fills them.
 *
 * `agent` is on the role list deliberately. It is the same set that may edit a
 * property, and gating this to admin/editor would put the wait back — which is
 * the thing the free-text escape hatch existed to remove.
 */
const AMENITY_PICKER_ROLES = ["admin", "editor", "agent"] as const;

/** Where a derived code lands when the label has no Latin in it at all. */
const FALLBACK_CODE_BASE = "custom_amenity";

export type AddAmenityToTaxonomyResult =
  /** A new row was written; select this card. */
  | { status: "created"; option: AmenityOption }
  /** An active row already said this; select that card instead. */
  | { status: "exists"; option: AmenityOption }
  /**
   * Nothing was written. The caller keeps the value as free text on the
   * listing rather than losing what the lister typed — the pre-existing
   * behaviour, now the failure path instead of the only path.
   */
  | { status: "error"; message: string };

function normaliseLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim();
}

function toOption(entry: AmenityTaxonomyEntry): AmenityOption {
  return {
    code: entry.code,
    label: entry.label,
    label_ar: entry.label_ar ?? null,
    category: entry.category,
  };
}

/**
 * A code no active or inactive row is using.
 *
 * Suffixed rather than rejected, because the collision an agent hits is not
 * one they can do anything about: "24/7 Security" and "Security gate" both
 * derive `security`, and one of them is already in the table. The label is
 * what anybody reads; the code only has to be unique.
 */
function freeCode(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return "";
}

export async function addAmenityToTaxonomy(input: {
  label: string;
  label_ar?: string | null;
  category?: string;
}): Promise<AddAmenityToTaxonomyResult> {
  await requireRole(AMENITY_PICKER_ROLES);

  const label = normaliseLabel(input.label);
  if (label.length < 2) {
    return { status: "error", message: "Type an amenity name." };
  }
  if (label.length > MAX_AMENITY_LENGTH) {
    return {
      status: "error",
      message: `Keep it to ${MAX_AMENITY_LENGTH} characters or fewer.`,
    };
  }

  const category = (AMENITY_CATEGORIES as readonly string[]).includes(
    input.category ?? "",
  )
    ? (input.category as AmenityTaxonomyEntry["category"])
    : "building";

  const all = await listAmenitiesTaxonomyForAdmin();

  // Same comparison migration 0106 enforces in Postgres and `lib/amenities.ts`
  // uses to resolve a stored value: one *selectable* amenity per label.
  const key = label.toLowerCase();
  const active = all.find(
    (a) => a.active !== false && a.label.replace(/\s+/g, " ").trim().toLowerCase() === key,
  );
  if (active) return { status: "exists", option: toOption(active) };

  const base = amenityCodeFromLabel(label) ?? FALLBACK_CODE_BASE;
  const code = freeCode(base, new Set(all.map((a) => a.code)));
  if (!code) {
    return {
      status: "error",
      message: "Couldn’t derive a code for that name. Add it under Settings → Fields.",
    };
  }

  const labelAr = normaliseLabel(input.label_ar ?? "");
  const parsed = amenityTaxonomyEntrySchema.safeParse({
    code,
    label,
    label_ar: labelAr === "" ? null : labelAr,
    category,
    icon: null,
    // Past every seeded entry, so a picker addition sorts to the end of its
    // group rather than into the middle of the curated list.
    sort_order:
      Math.max(0, ...all.map((a) => a.sort_order ?? 0)) + 10,
    active: true,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "That name can’t be saved.",
    };
  }

  const ok = await upsertAmenityTaxonomyEntry(parsed.data);
  if (!ok) {
    return { status: "error", message: "Couldn’t add it to the amenity list." };
  }

  await logAudit({
    action: "amenity_taxonomy.create_from_picker",
    target_kind: "amenity",
    target_id: parsed.data.code,
    before: null,
    after: { ...parsed.data },
  });

  revalidatePath("/admin/settings/fields");
  return { status: "created", option: toOption(parsed.data) };
}
