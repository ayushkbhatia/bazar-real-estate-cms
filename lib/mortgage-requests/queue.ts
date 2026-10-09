/**
 * The queue's rules (C1; SPEC §4.3): which statuses each tab holds, the
 * "promise due" order, search matching and the at-risk list. Pure, so the
 * server's loader and the tests share one definition.
 */

import type { SlaStatus } from "./sla";

export const QUEUE_TABS = ["open", "new", "in_review", "awaiting", "with_banks", "contacted_booked", "closed"] as const;
export type QueueTab = (typeof QUEUE_TABS)[number];

export type RequestStatus =
  | "new"
  | "in_review"
  | "awaiting_applicant"
  | "with_banks"
  | "pre_approved"
  | "declined"
  | "contacted"
  | "consultation_booked"
  | "completed";

export const CLOSED_STATUSES: readonly RequestStatus[] = ["pre_approved", "declined", "completed"];

const TAB_STATUSES: Record<Exclude<QueueTab, "open" | "closed">, readonly RequestStatus[]> = {
  new: ["new"],
  in_review: ["in_review"],
  awaiting: ["awaiting_applicant"],
  with_banks: ["with_banks"],
  contacted_booked: ["contacted", "consultation_booked"],
};

export function inTab(status: RequestStatus, tab: QueueTab): boolean {
  if (tab === "open") return !CLOSED_STATUSES.includes(status);
  if (tab === "closed") return CLOSED_STATUSES.includes(status);
  return TAB_STATUSES[tab].includes(status);
}

export type ServiceFilter = "all" | "pre_approval" | "consultancy";
export const SERVICE_FILTERS: readonly ServiceFilter[] = ["all", "pre_approval", "consultancy"];

/**
 * C1's view as the URL holds it: everything but the search text, which can be
 * a name and so stays out of the address bar (docs/mortgage/cms/C1).
 * `owner` is "anyone", "me", "unassigned" or a team member's id.
 */
export type QueueParams = {
  tab: QueueTab;
  service: ServiceFilter;
  owner: string;
  page: number;
  /** "Show only these": the at-risk files alone. */
  risk: boolean;
  /** The list (C1 as designed) or the board, its columns the statuses (Bazar, 9 Oct 2026). */
  view: QueueView;
};

export type QueueView = "list" | "board";

export const DEFAULT_QUEUE_PARAMS: QueueParams = { tab: "open", service: "all", owner: "anyone", page: 1, risk: false, view: "list" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The view from the URL's search params; anything unknown falls back to the default. */
export function parseQueueParams(sp: Record<string, string | string[] | undefined>): QueueParams {
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const tab = one("tab");
  const service = one("service");
  const owner = one("owner");
  const page = Number(one("page"));
  return {
    tab: QUEUE_TABS.includes(tab as QueueTab) ? (tab as QueueTab) : "open",
    service: SERVICE_FILTERS.includes(service as ServiceFilter) ? (service as ServiceFilter) : "all",
    owner: owner === "me" || owner === "unassigned" || (owner && UUID.test(owner)) ? owner : "anyone",
    page: Number.isInteger(page) && page > 1 ? page : 1,
    risk: one("risk") === "1",
    view: one("view") === "board" ? "board" : "list",
  };
}

/** The URL's query string for a view, with defaults left out so a plain /admin/mortgages stays plain. */
export function queueQuery(params: QueueParams): string {
  const out = new URLSearchParams();
  if (params.tab !== "open") out.set("tab", params.tab);
  if (params.service !== "all") out.set("service", params.service);
  if (params.owner !== "anyone") out.set("owner", params.owner);
  if (params.risk) out.set("risk", "1");
  if (params.page > 1) out.set("page", String(params.page));
  if (params.view === "board") out.set("view", "board");
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** What the promise-due order needs of a row. */
export type Orderable = {
  service: "pre_approval" | "consultancy";
  status: RequestStatus;
  submittedAt: string;
  sla: SlaStatus | null;
  /** The booked consultation's start, for Consultation booked rows. */
  bookedAt: string | null;
  /** The latest contact, for Contacted rows. */
  lastContactAt: string | null;
};

const CONSULT_RANK: Partial<Record<RequestStatus, number>> = { new: 0, contacted: 1, consultation_booked: 2 };

/**
 * "Promise due" (SPEC §4.3): pre-approvals by working time left, soonest
 * first — a paused file by its frozen remainder, an overdue one first of all —
 * then consultancy: New by longest waiting, then Contacted, then Booked by
 * appointment time. Ties fall back to submission order.
 */
export function promiseDueCompare(a: Orderable, b: Orderable): number {
  if (a.service !== b.service) return a.service === "pre_approval" ? -1 : 1;
  if (a.service === "pre_approval") {
    const ra = (a.sla && a.sla.state !== "none" ? a.sla.remainingSeconds : null) ?? Number.POSITIVE_INFINITY;
    const rb = (b.sla && b.sla.state !== "none" ? b.sla.remainingSeconds : null) ?? Number.POSITIVE_INFINITY;
    if (ra !== rb) return ra - rb;
    return a.submittedAt.localeCompare(b.submittedAt);
  }
  const rank = (CONSULT_RANK[a.status] ?? 3) - (CONSULT_RANK[b.status] ?? 3);
  if (rank !== 0) return rank;
  if (a.status === "consultation_booked") {
    return (a.bookedAt ?? "").localeCompare(b.bookedAt ?? "");
  }
  if (a.status === "contacted") {
    return (a.lastContactAt ?? "").localeCompare(b.lastContactAt ?? "");
  }
  return a.submittedAt.localeCompare(b.submittedAt);
}

/** Running pre-approvals with the at-risk window reached (the banner). Overdue ones are "breached", not "at risk". */
export function isAtRisk(sla: SlaStatus | null): boolean {
  return !!sla && sla.state === "at_risk";
}

/**
 * Search: the name (contains, any case), the reference with or without its
 * "BZM-", or the mobile's last four or more digits.
 */
export function matchesSearch(
  row: { fullName: string; reference: string; mobile: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (row.fullName.toLowerCase().includes(q)) return true;
  // "BZM-26-0412", "26-0412" or "0412".
  const ref = row.reference.toLowerCase();
  const compact = q.replace(/\s+/g, "").replace(/^bzm-?/, "");
  if (compact.length >= 2 && ref.replace(/^bzm-/, "").includes(compact)) return true;
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 4 && row.mobile.replace(/\D/g, "").endsWith(digits)) return true;
  return false;
}

export const PAGE_SIZE = 25;
