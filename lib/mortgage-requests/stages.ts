import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Mortgage stages (0158): the pipeline a Fast Pre-Approval moves through,
 * kept by the client in Pages & blocks → Mortgage stages. A file moves freely
 * between them (`mortgage_move_stage()`); Declined sits beside them.
 *
 * `stopsClock`: the team has answered the applicant — the first move onto such
 * a stage stops the 24-hour clock for good. `closesFile`: a file on it counts
 * as closed (Disbursed). New requests land on the first stage.
 */
export type MortgageStage = {
  id: string;
  name: string;
  position: number;
  stopsClock: boolean;
  closesFile: boolean;
};

type StageRow = { id: string; name: string; position: number; stops_clock: boolean; closes_file: boolean };

export function toStage(r: StageRow): MortgageStage {
  return { id: r.id, name: r.name, position: r.position, stopsClock: r.stops_clock, closesFile: r.closes_file };
}

/** Every stage, first to last. Read through the caller's session: RLS lets the team and the stage editors see them. */
export async function loadStages(db: SupabaseClient): Promise<MortgageStage[]> {
  const { data, error } = await db
    .from("mortgage_stages")
    .select("id, name, position, stops_clock, closes_file")
    .order("position");
  if (error) throw new Error(`stages read failed: ${error.code}`);
  return ((data ?? []) as StageRow[]).map(toStage);
}

/** The board column / filter key for a file: its stage, or "declined". */
export type StageKey = string;
export const DECLINED_KEY = "declined";
