/**
 * The queue's board view (Bazar, 9 Oct 2026: "a kanban view … mortgage
 * applicants dragged and dropped into the relevant state fields"): its
 * columns, and what dropping a card on one does.
 *
 * A Fast Pre-Approval's columns are its stages (0158), which the client keeps
 * in Pages & blocks, and Declined. A file moves freely between stages — any
 * stage to any other, a closed or declined file included (Bazar, 13 Oct 2026)
 * — so a drop there is the move itself. Declining needs a reason and a
 * message, so that drop opens the decline dialog.
 *
 * A consultancy request keeps its statuses, and most of its moves carry
 * something the team has to supply, so a drop names the action that makes
 * the move: some the board runs, some it asks one question for, the rest open
 * the screen built for them. Moves SPEC §2.4 doesn't allow come back as
 * `illegal` with the reason, and the card stays put.
 */

import { DECLINED_KEY } from "./stages";

export type BoardService = "pre_approval" | "consultancy";

/** The consultancy lane's columns, left to right. */
export const CONSULTANCY_COLUMNS = ["new", "contacted", "consultation_booked", "completed"] as const;
export type ConsultancyColumn = (typeof CONSULTANCY_COLUMNS)[number];

/** How many closed files a closed column shows, newest first; the list's Closed tab has the rest. */
export const BOARD_CLOSED_LIMIT = 12;

export type IllegalReason = "closed" | "backwards" | "needsContact" | "needsBooking";

export type BoardMove =
  | { kind: "same" }
  | { kind: "illegal"; why: IllegalReason }
  /** Fast Pre-Approval: onto a stage, at once (a declined file is reopened there). */
  | { kind: "move_stage"; stageId: string }
  /** → Declined: the decline dialog, on the board. */
  | { kind: "decline" }
  /** Consultancy New → Contacted: how the contact went, on the board. */
  | { kind: "log_contact" }
  /** Contacted → Consultation booked: C6's booking card, for the adviser and the slot. */
  | { kind: "book" }
  /** Consultation booked → Completed: mark it held. */
  | { kind: "held" };

/**
 * What dropping a card from column `from` onto column `to` does. For a Fast
 * Pre-Approval the keys are stage ids or `DECLINED_KEY`; for a consultancy,
 * its statuses.
 */
export function boardMove(service: BoardService, from: string, to: string): BoardMove {
  if (from === to) return { kind: "same" };

  if (service === "pre_approval") {
    if (to === DECLINED_KEY) return { kind: "decline" };
    return { kind: "move_stage", stageId: to };
  }

  if (from === "completed") return { kind: "illegal", why: "closed" };
  if (from === "new" && to === "contacted") return { kind: "log_contact" };
  if (from === "contacted" && to === "consultation_booked") return { kind: "book" };
  if (from === "consultation_booked" && to === "completed") return { kind: "held" };
  if (from === "new" && (to === "consultation_booked" || to === "completed")) return { kind: "illegal", why: "needsContact" };
  if (from === "contacted" && to === "completed") return { kind: "illegal", why: "needsBooking" };
  return { kind: "illegal", why: "backwards" };
}

/** Where a card sits on its lane: its stage or Declined, or its consultancy status. */
export function columnKeyOf(row: { service: BoardService; status: string; stage: { id: string } | null }): string {
  if (row.service === "consultancy") return row.status;
  return row.status === "declined" ? DECLINED_KEY : (row.stage?.id ?? "");
}

/** Moves the board finishes itself (at once, or after one question on the board). */
export function movesOnBoard(move: BoardMove): boolean {
  return ["move_stage", "decline", "log_contact", "held"].includes(move.kind);
}
