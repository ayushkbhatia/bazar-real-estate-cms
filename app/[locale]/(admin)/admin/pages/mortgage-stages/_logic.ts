/**
 * Pages & blocks → Mortgage stages: the pure parts of the editor — a stage's
 * name as the database will take it, a move up or down as the id order
 * `mortgage_reorder_stages()` wants, and the database's refusals (0158) as the
 * screen words them.
 */

export const STAGE_NAME_MAX = 40;

/** The name as it is stored (trimmed), or null when the database would refuse it (1 to 40 characters). */
export function cleanStageName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= STAGE_NAME_MAX ? name : null;
}

/** Every id, first to last, with `id` moved one place up (-1) or down (+1); null when it can't move that way. */
export function moveStage(ids: readonly string[], id: string, delta: -1 | 1): string[] | null {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return null;
  const next = [...ids];
  next[from] = next[to]!;
  next[to] = id;
  return next;
}

export type StageDbError = { code?: string; message: string };

export type StageRefusal = {
  message: string;
  /** False for anything the stage functions don't raise on purpose: worth reporting. */
  known: boolean;
};

/** A refusal from mortgage_save_stage / mortgage_reorder_stages / mortgage_delete_stage, in the screen's words. */
export function stageRefusal(error: StageDbError): StageRefusal {
  const msg = error.message ?? "";
  switch (error.code) {
    case "MR403":
      return { message: "You can't change the mortgage stages.", known: true };
    case "MR404":
      return { message: "That stage no longer exists. Reload the page.", known: true };
    case "MR422":
      return msg.includes("every stage")
        ? { message: "The stages changed since this page loaded. Reload and try again.", known: true }
        : { message: `A stage needs a name of 1 to ${STAGE_NAME_MAX} characters.`, known: true };
    case "MR409": {
      if (msg.includes("stage_name_taken")) return { message: "Another stage already has that name.", known: true };
      if (msg.includes("last_stage")) return { message: "Keep at least one stage.", known: true };
      const inUse = /stage_in_use:(\d+)/.exec(msg);
      if (inUse) {
        const n = Number(inUse[1]);
        return {
          message:
            n === 1
              ? "1 file is on this stage. Move it to another stage first."
              : `${n} files are on this stage. Move them to another stage first.`,
          known: true,
        };
      }
      return { message: "The stages changed since this page loaded. Reload and try again.", known: true };
    }
    default:
      return { message: "That didn't save. Try again.", known: false };
  }
}
