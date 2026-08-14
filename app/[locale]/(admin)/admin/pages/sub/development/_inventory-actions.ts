"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  inventorySchema,
  type UnitRowInput,
} from "@/lib/schemas/development-inventory";
import type { SubPageResult } from "./_actions";

/**
 * Sales inventory for one project — the rows behind the public "What's left"
 * table.
 *
 * Separate from `_unit-actions.ts` even though both save unit-shaped things:
 * that one owns the catalogue (`development_unit_types` and the layouts under
 * them) and this one owns the stock. They are different tables, different
 * cardinality and different editors, and the only thing they share is the
 * `floor_plan_id` this action validates against.
 */

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

async function loadRecord(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { record: null, message: error.message };
  if (!data) return { record: null, message: "Development not found." };
  return { record: data, message: null };
}

/**
 * Reconcile the submitted grid against what's stored: a row carrying an id is
 * an update, one without is an insert, and anything in the table the payload no
 * longer mentions is deleted.
 *
 * Deletes go first for the same reason as unit types — a row re-numbered onto a
 * plot another row is vacating should not collide with it mid-save — and
 * because leaving them until last means a failed insert halfway through would
 * keep rows the editor had already removed on screen.
 */
async function persist(
  developmentId: string,
  units: UnitRowInput[],
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data: existing, error: readError } = await supabase
    .from("development_units")
    .select("id")
    .eq("development_id", developmentId);
  if (readError) return { error: readError.message };

  const kept = new Set(
    units.map((u) => u.id).filter((id): id is string => id !== null),
  );
  const dropped = (existing ?? []).map((u) => u.id).filter((id) => !kept.has(id));

  if (dropped.length > 0) {
    const { error } = await supabase
      .from("development_units")
      .delete()
      .in("id", dropped);
    if (error) return { error: error.message };
  }

  for (const [index, unit] of units.entries()) {
    const row = {
      development_id: developmentId,
      unit_type: unit.unit_type.trim(),
      unit_type_ar: unit.unit_type_ar,
      beds: unit.beds,
      built_up_ft2: unit.built_up_ft2,
      plot_ft2: unit.plot_ft2,
      lagoon_access: unit.lagoon_access,
      lagoon_access_ar: unit.lagoon_access_ar,
      orientation: unit.orientation,
      orientation_ar: unit.orientation_ar,
      price_aed: unit.price_aed,
      plot_number: unit.plot_number,
      status: unit.status,
      floor_plan_id: unit.floor_plan_id,
      sort_order: index,
    };

    const written = unit.id
      ? await supabase
          .from("development_units")
          .update(row)
          .eq("id", unit.id)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("development_units")
          .insert(row)
          .select("id")
          .maybeSingle();

    if (written.error) return { error: written.error.message };
    if (!written.data)
      return {
        error:
          "Not saved — your account may not have permission to edit this project.",
      };
  }

  return { error: null };
}

export async function saveDevelopmentUnits(
  slug: string,
  raw: unknown,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const parsed = inventorySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: parsed.error.issues.map((i) => {
        // "units.7.unit_type" tells an editor nothing; "Unit 8 · unit_type"
        // at least points at the row they can count to.
        const [, rowIndex, ...rest] = i.path;
        const where =
          typeof rowIndex === "number"
            ? `Unit ${rowIndex + 1} · ${rest.join(".") || "row"}`
            : "Inventory";
        return `${where}: ${i.message}`;
      }),
    };
  }

  // `floor_plans.id` has no foreign key back to this project — the column
  // references the table, not the development — so a plan id from a *different*
  // project would insert happily and then render someone else's layout on this
  // page. Checked here because this is the only place that knows both.
  const linked = parsed.data.units
    .map((u) => u.floor_plan_id)
    .filter((id): id is string => id !== null);
  if (linked.length > 0) {
    const supabase = await createSupabaseServerClient();
    const { data: plans, error } = await supabase
      .from("floor_plans")
      .select("id")
      .eq("development_id", record.id)
      .in("id", linked);
    if (error) return { status: "error", message: error.message };
    const valid = new Set((plans ?? []).map((p) => p.id));
    const strays = linked.filter((id) => !valid.has(id));
    if (strays.length > 0)
      return {
        status: "invalid",
        message: "A unit points at a floor plan from another project.",
        issues: [
          "Re-pick the layout on the affected rows — the list only offers this project's.",
        ],
      };
  }

  const { error } = await persist(record.id, parsed.data.units);
  if (error) return { status: "error", message: error };

  await logAudit({
    action: "development.units_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: {
      units: parsed.data.units.length,
      available: parsed.data.units.filter((u) => u.status === "available")
        .length,
    },
  });

  revalidateLocalised(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  return { status: "ok", message: "Inventory saved." };
}
