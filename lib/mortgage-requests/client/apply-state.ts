/**
 * The wizard's state (docs/mortgage/frontend/00-foundations §6): everything
 * W1–W7 know, kept in the browser until submit, as W2 promises ("Your
 * answers stay in your browser until you submit").
 *
 * sessionStorage, so it belongs to one tab and goes when the tab closes. Only
 * metadata: file names and sizes, never bytes. After a successful submit the
 * state is replaced by `{ submitted }` alone, so Back can't resubmit and the
 * details don't linger.
 *
 * This module is pure, so W1's server page can parse entry links with it;
 * the storage and the hook live in ./apply-store.ts.
 */

import type { DocKind } from "../documents";
import {
  ENTRY_POINTS,
  SERVICES,
  validateDetails,
  type Details,
  type DetailsDraft,
  type EntryPoint,
  type Residency,
  type Service,
} from "../details";
import { SITE_LOCALE_PARAM } from "@/lib/i18n/routing";
import type { DraftHandle } from "./api";

export const STORE_KEY = "bz.mortgage.apply.v1";

/** A ready file on the server, as the documents page restores it after a reload. */
export type StoredFile = { localId: string; fileId: string; name: string; sizeBytes: number; mime: string };

export type SubmittedSummary = {
  reference: string;
  service: Service;
  submittedAt: string;
  dueAt: string | null;
  residency: Residency;
  employmentType: Details["employmentType"];
  mobile: string;
  email: string;
  /** Pre-approval: the documents and how many files each had, for W7's rail. */
  documents?: { kind: DocKind; files: number }[];
  /** Where "Back to Bazar" goes. */
  returnTo?: string;
};

export type ApplyState = {
  v: 1;
  service?: Service;
  entryPoint: EntryPoint;
  propertyRef?: string;
  /** Which version of the site the applicant came from (0155 `site_locale`); unset reads as English. */
  siteLocale?: SiteLocale;
  /** A path on this site the applicant came from: Exit and "Back to Bazar" return there. */
  returnTo?: string;
  details: DetailsDraft;
  draft?: DraftHandle;
  files: Partial<Record<DocKind, StoredFile[]>>;
  consent: boolean;
  /** Sent as Idempotency-Key on submit, so a retry can't make a second application. */
  idempotencyKey: string;
  /** A detail the server refused at submit (a 422 with a field): W2 marks it. */
  flagged?: { field: string; rule: string };
  submitted?: SubmittedSummary;
};

function newKey(): string {
  return crypto.randomUUID();
}

export function freshState(): ApplyState {
  return { v: 1, entryPoint: "direct", details: {}, files: {}, consent: false, idempotencyKey: newKey() };
}

// ── Entry links (SPEC §4.1) ─────────────────────────────────────

const PROPERTY_REF = /^[A-Za-z0-9][A-Za-z0-9-]{1,39}$/;

export type SiteLocale = "en" | "ar";

export type EntryParams = { service?: Service; entryPoint?: EntryPoint; propertyRef?: string; siteLocale?: SiteLocale };

/** The query keys an entry link may carry, for the page that reads them. */
export const ENTRY_PARAM_KEYS = ["service", "from", "property", SITE_LOCALE_PARAM] as const;

/**
 * `?service=`, `?from=`, `?property=` and `?site=` from an entry link. An
 * invalid service is ignored; an unknown `from` counts as a direct visit; an
 * unknown `site` is ignored.
 */
export function parseEntryParams(params: URLSearchParams): EntryParams {
  const out: EntryParams = {};
  const service = params.get("service");
  if (service && (SERVICES as readonly string[]).includes(service)) out.service = service as Service;
  const from = params.get("from");
  if (from !== null) {
    out.entryPoint = (ENTRY_POINTS as readonly string[]).includes(from) ? (from as EntryPoint) : "direct";
  }
  const property = params.get("property");
  if (property && PROPERTY_REF.test(property)) out.propertyRef = property;
  const site = params.get(SITE_LOCALE_PARAM);
  if (site === "en" || site === "ar") out.siteLocale = site;
  return out;
}

/**
 * Fold an entry link into the state. The link wins over what the tab
 * remembered. `referredFrom`, the site version of the page that sent the
 * visitor here (`siteLocaleFromReferrer`), stands in when the link carries no
 * `site`: a link the site didn't draw, or a bookmark opened from an /ar page.
 */
export function applyEntry(state: ApplyState, entry: EntryParams, returnTo?: string, referredFrom?: SiteLocale): ApplyState {
  const next: ApplyState = { ...state };
  const site = entry.siteLocale ?? referredFrom;
  if (site) next.siteLocale = site;
  if (entry.service) next.service = entry.service;
  if (entry.entryPoint) {
    next.entryPoint = entry.entryPoint;
    next.propertyRef = entry.propertyRef;
  } else if (entry.propertyRef) {
    next.propertyRef = entry.propertyRef;
  }
  if (returnTo) next.returnTo = returnTo;
  return next;
}

/** `ar` when `document.referrer` is an /ar page on this site, `en` for any other page on it, else undefined. */
export function siteLocaleFromReferrer(referrer: string, origin: string): SiteLocale | undefined {
  try {
    const url = new URL(referrer);
    if (url.origin !== origin || url.pathname.startsWith("/mortgages")) return undefined;
    return url.pathname === "/ar" || url.pathname.startsWith("/ar/") ? "ar" : "en";
  } catch {
    return undefined;
  }
}

/** A same-site path from `document.referrer`, outside the flow, or undefined. */
export function returnPathFrom(referrer: string, origin: string): string | undefined {
  try {
    const url = new URL(referrer);
    if (url.origin !== origin) return undefined;
    if (url.pathname.startsWith("/mortgages")) return undefined;
    return `${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

// ── Guards (00-foundations §6) ──────────────────────────────────

export type FlowRoute = "service" | "details" | "review" | "documents" | "received";

export const FLOW_PATHS: Record<FlowRoute, string> = {
  service: "/mortgages/apply",
  details: "/mortgages/apply/details",
  review: "/mortgages/apply/review",
  documents: "/mortgages/apply/documents",
  received: "/mortgages/apply/received",
};

export function detailsComplete(state: ApplyState): boolean {
  return validateDetails(state.details).ok;
}

/** Where to send someone who opened `route` without what it needs, or null to stay. */
export function guardRedirect(state: ApplyState, route: FlowRoute): string | null {
  if (route === "service") return null;
  if (route === "received") return state.submitted ? null : FLOW_PATHS.service;
  // Just submitted: every step leads to the confirmation, so Back can't
  // resubmit and the step that sent it can't bounce the applicant to W1.
  if (!state.service) return state.submitted ? FLOW_PATHS.received : FLOW_PATHS.service;
  if (route === "details") return null;
  if (!detailsComplete(state)) return FLOW_PATHS.details;
  if (route === "review" && state.service !== "consultancy") return FLOW_PATHS.documents;
  if (route === "documents" && state.service !== "pre_approval") return FLOW_PATHS.review;
  return null;
}

/** After a successful submit: the summary and nothing else. */
export function afterSubmit(state: ApplyState, submitted: SubmittedSummary): ApplyState {
  return { ...freshState(), entryPoint: state.entryPoint, siteLocale: state.siteLocale, submitted };
}
