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
  type AmenityTaxonomyEntry,
} from "@/lib/schemas/amenity-taxonomy";

const FIELDS_ROLES = ["admin", "editor"] as const;

/** Mirrors how lib/amenities.ts compares stored values to the taxonomy. */
function normaliseLabel(label: string): string {
  return label.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * The taxonomy keys on code, but the catalogue stores *labels* — two active
 * entries sharing a label are one amenity twice over, and a listing that ticks
 * it spends two slots of its amenities cap for one visible selection (#386).
 * Migration 0106 enforces this in Postgres; this check exists so the editor
 * says which entry is in the way instead of surfacing "Insert failed."
 */
function activeLabelClash(
  all: AmenityTaxonomyEntry[],
  label: string,
  exceptCode: string,
): AmenityTaxonomyEntry | undefined {
  const key = normaliseLabel(label);
  return all.find(
    (a) =>
      a.code !== exceptCode &&
      a.active !== false &&
      normaliseLabel(a.label) === key,
  );
}

export type AmenityActionResult =
  | { status: "ok" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string> };

/**
 * Flip the `active` flag on an existing amenity. Inactive entries stay
 * in the table (so the property editor can still resolve the historical
 * code on existing listings) but are dropped from new toggles + the
 * /buy /rent facet.
 */
export async function toggleAmenityActive(
  code: string,
  nextActive: boolean,
): Promise<AmenityActionResult> {
  await requireRole(FIELDS_ROLES);

  const all = await listAmenitiesTaxonomyForAdmin();
  const existing = all.find((a) => a.code === code);
  if (!existing) {
    return { status: "error", message: "Amenity code not found." };
  }

  if (nextActive) {
    const clash = activeLabelClash(all, existing.label, existing.code);
    if (clash) {
      return {
        status: "error",
        message: `“${clash.label}” is already active as "${clash.code}". Turn that one off first.`,
      };
    }
  }

  const ok = await upsertAmenityTaxonomyEntry({
    ...existing,
    active: nextActive,
  });
  if (!ok) return { status: "error", message: "Update failed." };

  await logAudit({
    action: "amenity_taxonomy.toggle_active",
    target_kind: "amenity",
    target_id: code,
    before: { code, active: existing.active },
    after: { code, active: nextActive },
  });

  revalidatePath("/admin/settings/fields");
  return { status: "ok" };
}

/**
 * Add a new amenity entry. Validates with the canonical zod schema so
 * the same shape applies whether the row comes from the editor or a
 * seed migration.
 */
export async function createAmenity(
  raw: Record<string, unknown>,
): Promise<AmenityActionResult> {
  await requireRole(FIELDS_ROLES);

  const parsed = amenityTaxonomyEntrySchema.safeParse({
    code: typeof raw.code === "string" ? raw.code.trim().toLowerCase() : "",
    label: typeof raw.label === "string" ? raw.label.trim() : "",
    label_ar:
      typeof raw.label_ar === "string" && raw.label_ar.trim() !== ""
        ? raw.label_ar.trim()
        : null,
    category: raw.category,
    icon:
      typeof raw.icon === "string" && raw.icon.trim().length > 0
        ? raw.icon.trim()
        : null,
    sort_order:
      typeof raw.sort_order === "string"
        ? Number(raw.sort_order)
        : typeof raw.sort_order === "number"
          ? raw.sort_order
          : 0,
    active: true,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return {
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors,
    };
  }

  const entry: AmenityTaxonomyEntry = parsed.data;

  const all = await listAmenitiesTaxonomyForAdmin();
  if (all.some((a) => a.code === entry.code)) {
    return {
      status: "error",
      message: `Code "${entry.code}" already exists. Toggle the existing entry instead.`,
      fieldErrors: { code: "Already in use" },
    };
  }

  const labelClash = activeLabelClash(all, entry.label, entry.code);
  if (labelClash) {
    return {
      status: "error",
      // The point the old message missed: the collision that matters is the
      // label, and a fresh code does not resolve it.
      message: `“${labelClash.label}” already exists as "${labelClash.code}". Edit that entry instead of adding a second one.`,
      fieldErrors: { label: "Already in use" },
    };
  }

  const ok = await upsertAmenityTaxonomyEntry(entry);
  if (!ok) return { status: "error", message: "Insert failed." };

  await logAudit({
    action: "amenity_taxonomy.create",
    target_kind: "amenity",
    target_id: entry.code,
    before: null,
    after: { ...entry },
  });

  revalidatePath("/admin/settings/fields");
  return { status: "ok" };
}
