"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { reportError } from "@/lib/observability";
import { loadStages, type MortgageStage } from "@/lib/mortgage-requests/stages";
import { stageEditorSession } from "./_access";
import { cleanStageName, STAGE_NAME_MAX, stageRefusal, type StageDbError } from "./_logic";

/**
 * Pages & blocks → Mortgage stages. Every change goes through 0158's SQL
 * functions, called with the editor's own session, so the database decides
 * who may change the stages and refuses what would break a file — a stage
 * with files on it, the last stage, a name another stage has. The table is
 * never written here.
 */

export type StageActionResult =
  | { ok: true; message: string; stages?: MortgageStage[] }
  | { ok: false; message: string; stages?: MortgageStage[] };

const NOT_ALLOWED: StageActionResult = { ok: false, message: "You can't change the mortgage stages." };
const INVALID: StageActionResult = { ok: false, message: "That didn't save. Reload the page and try again." };

const id = z.string().uuid();
const saveSchema = z.object({
  id: id.nullable(),
  name: z.string().max(200),
  stopsClock: z.boolean(),
  closesFile: z.boolean(),
});

type Session = NonNullable<Awaited<ReturnType<typeof stageEditorSession>>>;

/** The stages as they now are, for the editor to show; undefined if the read fails (the revalidation still lands). */
async function fresh(s: Session): Promise<MortgageStage[] | undefined> {
  try {
    return await loadStages(s.supabase);
  } catch (error) {
    await reportError(error, { source: "mortgage.stages.read" });
    return undefined;
  }
}

function refresh() {
  // Admin paths sit outside the public locale cache, so a plain revalidatePath is right here.
  revalidatePath("/admin/pages/mortgage-stages");
  revalidatePath("/admin/mortgages");
}

async function refused(s: Session, error: StageDbError, source: string): Promise<StageActionResult> {
  const r = stageRefusal(error);
  // The code only: a message can quote a value.
  if (!r.known) await reportError(new Error(`mortgage stage action failed (${error.code ?? "unknown"})`), { source });
  return { ok: false, message: r.message, stages: await fresh(s) };
}

/** Add a stage (no id: at the end) or change one's name and switches. */
export async function saveStage(input: {
  id: string | null;
  name: string;
  stopsClock: boolean;
  closesFile: boolean;
}): Promise<StageActionResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const name = cleanStageName(parsed.data.name);
  if (!name) return { ok: false, message: `A stage needs a name of 1 to ${STAGE_NAME_MAX} characters.` };
  const s = await stageEditorSession();
  if (!s) return NOT_ALLOWED;

  const { data, error } = await s.supabase.rpc("mortgage_save_stage", {
    p_id: parsed.data.id,
    p_name: name,
    p_stops_clock: parsed.data.stopsClock,
    p_closes_file: parsed.data.closesFile,
  });
  if (error) return refused(s, error, "mortgage.stages.save");

  const added = parsed.data.id === null;
  await logAudit({
    action: added ? "mortgage.stage_add" : "mortgage.stage_update",
    target_kind: "mortgage_stage",
    target_id: data?.id ?? parsed.data.id,
    after: { name, stops_clock: parsed.data.stopsClock, closes_file: parsed.data.closesFile },
  });
  refresh();
  return {
    ok: true,
    message: added ? `Added “${name}” as the last stage.` : `Saved “${name}”. The mortgage board shows it now.`,
    stages: await fresh(s),
  };
}

/** The stages in a new order: every stage's id, once, first to last. */
export async function reorderStages(ids: string[]): Promise<StageActionResult> {
  const parsed = z.array(id).min(1).max(200).safeParse(ids);
  if (!parsed.success) return INVALID;
  const s = await stageEditorSession();
  if (!s) return NOT_ALLOWED;

  const { error } = await s.supabase.rpc("mortgage_reorder_stages", { p_ids: parsed.data });
  if (error) return refused(s, error, "mortgage.stages.reorder");

  await logAudit({ action: "mortgage.stage_reorder", target_kind: "mortgage_stage", target_id: null, after: { order: parsed.data } });
  refresh();
  return { ok: true, message: "New order saved. The mortgage board shows it now.", stages: await fresh(s) };
}

/** Remove a stage no file is on. The database keeps the last one, and one with files on it. */
export async function deleteStage(stageId: string): Promise<StageActionResult> {
  const parsed = id.safeParse(stageId);
  if (!parsed.success) return INVALID;
  const s = await stageEditorSession();
  if (!s) return NOT_ALLOWED;

  const { data: before } = await s.supabase.from("mortgage_stages").select("name").eq("id", parsed.data).maybeSingle();
  const { error } = await s.supabase.rpc("mortgage_delete_stage", { p_id: parsed.data });
  if (error) return refused(s, error, "mortgage.stages.delete");

  await logAudit({
    action: "mortgage.stage_delete",
    target_kind: "mortgage_stage",
    target_id: parsed.data,
    before: before ? { name: before.name } : null,
  });
  refresh();
  return {
    ok: true,
    message: before ? `Deleted “${before.name}”.` : "Stage deleted.",
    stages: await fresh(s),
  };
}
