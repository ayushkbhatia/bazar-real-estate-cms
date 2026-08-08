"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  seedUnitTypes,
  unitPlansSchema,
  type UnitTypeInput,
} from "@/lib/schemas/development-unit-plans";
import type { SubPageResult } from "./_actions";

/**
 * Unit types and their floor plans, saved from the project page editor.
 *
 * One action for both levels rather than one per row: the card edits them as a
 * single tree — reordering a type moves its layouts with it — and a save that
 * could half-apply would leave a page showing four layouts under the wrong
 * bedroom count.
 */

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

async function loadRecord(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("developments")
    .select("id, name, slug, bedrooms_text")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { record: null, message: error.message };
  if (!data) return { record: null, message: "Development not found." };
  return { record: data, message: null };
}

/**
 * Reconcile the submitted tree against what's stored.
 *
 * A row carrying an id is an update; one without is an insert; anything in the
 * database that the payload no longer mentions is deleted. Deletes go first so
 * a rename that reuses a freed-up label doesn't trip the unique index on
 * (development_id, lower(label)).
 */
async function persist(
  developmentId: string,
  unitTypes: UnitTypeInput[],
): Promise<{ error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data: existingTypes, error: readError } = await supabase
    .from("development_unit_types")
    .select("id")
    .eq("development_id", developmentId);
  if (readError) return { error: readError.message };

  const keptTypeIds = new Set(
    unitTypes.map((t) => t.id).filter((id): id is string => id !== null),
  );
  const droppedTypeIds = (existingTypes ?? [])
    .map((t) => t.id)
    .filter((id) => !keptTypeIds.has(id));

  if (droppedTypeIds.length > 0) {
    // floor_plans.unit_type_id is ON DELETE CASCADE, so the layouts under a
    // removed type go with it — which is the behaviour the card warns about.
    const { error } = await supabase
      .from("development_unit_types")
      .delete()
      .in("id", droppedTypeIds);
    if (error) return { error: error.message };
  }

  for (const [index, type] of unitTypes.entries()) {
    const row = {
      development_id: developmentId,
      label: type.label.trim(),
      beds: type.beds,
      blurb: type.blurb,
      size_from_ft2: type.size_from_ft2,
      size_to_ft2: type.size_to_ft2,
      price_from_aed: type.price_from_aed,
      enabled: type.enabled,
      sort_order: index,
    };

    const written = type.id
      ? await supabase
          .from("development_unit_types")
          .update(row)
          .eq("id", type.id)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("development_unit_types")
          .insert(row)
          .select("id")
          .maybeSingle();

    if (written.error) return { error: written.error.message };
    if (!written.data)
      return {
        error:
          "Not saved — your account may not have permission to edit this project.",
      };

    const typeId = written.data.id;

    const { data: existingPlans, error: plansReadError } = await supabase
      .from("floor_plans")
      .select("id")
      .eq("unit_type_id", typeId);
    if (plansReadError) return { error: plansReadError.message };

    const keptPlanIds = new Set(
      type.plans.map((p) => p.id).filter((id): id is string => id !== null),
    );
    const droppedPlanIds = (existingPlans ?? [])
      .map((p) => p.id)
      .filter((id) => !keptPlanIds.has(id));
    if (droppedPlanIds.length > 0) {
      const { error } = await supabase
        .from("floor_plans")
        .delete()
        .in("id", droppedPlanIds);
      if (error) return { error: error.message };
    }

    for (const [planIndex, plan] of type.plans.entries()) {
      const planRow = {
        development_id: developmentId,
        unit_type_id: typeId,
        label: plan.label.trim(),
        description: plan.description,
        beds: plan.beds,
        baths: plan.baths,
        area_ft2: plan.area_ft2,
        media_id: plan.media_id,
        enabled: plan.enabled,
        sort_order: planIndex,
      };
      const write = plan.id
        ? await supabase.from("floor_plans").update(planRow).eq("id", plan.id)
        : await supabase.from("floor_plans").insert(planRow);
      if (write.error) return { error: write.error.message };
    }
  }

  return { error: null };
}

export async function saveDevelopmentUnitPlans(
  slug: string,
  raw: unknown,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const parsed = unitPlansSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: parsed.error.issues.map((i) => {
        // "unit_types.1.label" says nothing to an editor; "Unit type 2 · Name"
        // points at the box.
        const [, typeIndex, ...rest] = i.path;
        const where =
          typeof typeIndex === "number"
            ? `Unit type ${typeIndex + 1} · ${rest.join(".") || "row"}`
            : "Units";
        return `${where}: ${i.message}`;
      }),
    };
  }

  const { error } = await persist(record.id, parsed.data.unit_types);
  if (error) {
    if (error.includes("development_unit_types_label_idx"))
      return {
        status: "invalid",
        message: "Two unit types share a name.",
        issues: ["Each unit type needs its own name."],
      };
    return { status: "error", message: error };
  }

  await logAudit({
    action: "development.unit_plans_update",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: {
      unit_types: parsed.data.unit_types.length,
      floor_plans: parsed.data.unit_types.reduce(
        (n, t) => n + t.plans.length,
        0,
      ),
    },
  });

  revalidatePath(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  return { status: "ok", message: "Units & floor plans saved." };
}

/**
 * "Add the suggested unit types" — writes the same starting set the public
 * page would otherwise show as placeholders, so the first edit is a correction
 * rather than a blank form. Refuses if the project already has types, since
 * that would either duplicate labels or silently overwrite real work.
 */
export async function seedDevelopmentUnitPlans(
  slug: string,
): Promise<SubPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Development not found." };

  const supabase = await createSupabaseServerClient();
  const { count, error: countError } = await supabase
    .from("development_unit_types")
    .select("id", { count: "exact", head: true })
    .eq("development_id", record.id);
  if (countError) return { status: "error", message: countError.message };
  if ((count ?? 0) > 0)
    return {
      status: "error",
      message:
        "This project already has unit types — add another one instead of starting over.",
    };

  const { error } = await persist(record.id, seedUnitTypes(record.bedrooms_text));
  if (error) return { status: "error", message: error };

  await logAudit({
    action: "development.unit_plans_seed",
    target_kind: "development",
    target_id: record.id,
    before: null,
    after: { bedrooms_text: record.bedrooms_text },
  });

  revalidatePath(`/developments/${record.slug}`);
  revalidatePath(`/admin/pages/sub/development/${record.slug}`);
  return { status: "ok", message: "Starter unit types added." };
}
