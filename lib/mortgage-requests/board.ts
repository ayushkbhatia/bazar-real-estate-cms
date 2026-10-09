/**
 * The queue's board view (Bazar, 9 Oct 2026: "a kanban view … mortgage
 * applicants dragged and dropped into the relevant state fields"): its
 * columns, and what dropping a card on one does.
 *
 * A drop is never a bare status write. Status moves only through
 * `mortgage_transition()` (state.ts mirrors it), and most moves carry
 * something the team has to supply — a re-upload needs a document and a
 * reason, sending to banks needs the banks, a decision needs the offer, a
 * decline needs a reason and a message. So a drop names the action that
 * makes the move: some the board runs at once, some it asks one question
 * for, and the rest open the screen built for them. Moves SPEC §2.4 doesn't
 * allow come back as `illegal` with the reason, and the card stays put.
 */

import type { RequestStatus } from "./queue";

export type BoardService = "pre_approval" | "consultancy";

/** Each service's columns, left to right, in the order a file travels. */
export const BOARD_COLUMNS: Record<BoardService, readonly RequestStatus[]> = {
  pre_approval: ["new", "in_review", "awaiting_applicant", "with_banks", "pre_approved", "declined"],
  consultancy: ["new", "contacted", "consultation_booked", "completed"],
};

export const BOARD_CLOSED: readonly RequestStatus[] = ["pre_approved", "declined", "completed"];

/** How many closed files a closed column shows, newest first; the list's Closed tab has the rest. */
export const BOARD_CLOSED_LIMIT = 12;

export type IllegalReason =
  | "closed"
  | "backwards"
  | "needsReview"
  | "needsBanks"
  | "reuploadOpen"
  | "needsContact"
  | "needsBooking";

export type BoardMove =
  | { kind: "same" }
  | { kind: "illegal"; why: IllegalReason }
  /** New → In review, run at once (the owner's first open does the same). */
  | { kind: "start_review" }
  /** → Awaiting applicant: which document? Then C4's re-upload form. */
  | { kind: "request_reupload" }
  /** Awaiting applicant → In review: cancel the open re-upload request. */
  | { kind: "cancel_reupload" }
  /** In review → With banks: C2's "Accept application", to choose the banks. */
  | { kind: "send_to_banks" }
  /** With banks → Pre-approved: C5, to record the offers and choose the lead. */
  | { kind: "decide" }
  /** → Declined: the decline dialog, on the board. */
  | { kind: "decline" }
  /** Consultancy New → Contacted: how the contact went, on the board. */
  | { kind: "log_contact" }
  /** Contacted → Consultation booked: C6's booking card, for the adviser and the slot. */
  | { kind: "book" }
  /** Consultation booked → Completed: mark it held. */
  | { kind: "held" };

const ORDER = (service: BoardService, status: RequestStatus) => BOARD_COLUMNS[service].indexOf(status);

/** What dropping a `service` card from `from` onto `to` does. */
export function boardMove(service: BoardService, from: RequestStatus, to: RequestStatus): BoardMove {
  if (from === to) return { kind: "same" };
  if (BOARD_CLOSED.includes(from)) return { kind: "illegal", why: "closed" };

  if (service === "pre_approval") {
    if (to === "declined") return { kind: "decline" };
    if (from === "new" && to === "in_review") return { kind: "start_review" };
    // A re-upload can be asked before the first open: the request moves the file on first.
    if ((from === "new" || from === "in_review") && to === "awaiting_applicant") return { kind: "request_reupload" };
    if (from === "awaiting_applicant" && to === "in_review") return { kind: "cancel_reupload" };
    if (from === "in_review" && to === "with_banks") return { kind: "send_to_banks" };
    if (from === "with_banks" && to === "pre_approved") return { kind: "decide" };
    if (to === "pre_approved") return { kind: "illegal", why: "needsBanks" };
    if (from === "awaiting_applicant" && to === "with_banks") return { kind: "illegal", why: "reuploadOpen" };
    if (from === "new" && to === "with_banks") return { kind: "illegal", why: "needsReview" };
    return { kind: "illegal", why: ORDER(service, to) < ORDER(service, from) ? "backwards" : "needsReview" };
  }

  if (from === "new" && to === "contacted") return { kind: "log_contact" };
  if (from === "contacted" && to === "consultation_booked") return { kind: "book" };
  if (from === "consultation_booked" && to === "completed") return { kind: "held" };
  if (from === "new" && (to === "consultation_booked" || to === "completed")) return { kind: "illegal", why: "needsContact" };
  if (from === "contacted" && to === "completed") return { kind: "illegal", why: "needsBooking" };
  return { kind: "illegal", why: "backwards" };
}

/** Moves the board finishes itself (at once, or after one question on the board). */
export function movesOnBoard(move: BoardMove): boolean {
  return ["start_review", "cancel_reupload", "decline", "log_contact", "held"].includes(move.kind);
}
