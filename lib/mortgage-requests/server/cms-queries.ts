import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allRows } from "@/lib/salesforce/listings/paginate";
import { buildActivity, staffIdsIn, type ActivityLine, type ContactInput, type EventInput } from "../activity";
import {
  ageOn,
  describeUserAgent,
  formatActivityTime,
  formatBookedAt,
  formatDayMonth,
  formatLongDate,
  formatWhen,
  initialsOf,
  maskIp,
  maskMobile,
  receivedParts,
} from "../cms-format";
import { cmsT } from "../cms-strings";
import { isConsentVersion, PENDING_COMPLIANCE } from "../consent";
import { DOCUMENT_SETS, type DocKind } from "../documents";
import { formatDayTime, formatMobile, formatTime } from "../format";
import {
  CLOSED_STATUSES,
  inTab,
  isAtRisk,
  matchesSearch,
  PAGE_SIZE,
  promiseDueCompare,
  QUEUE_TABS,
  type QueueParams,
  type QueueTab,
  type RequestStatus,
  type ServiceFilter,
} from "../queue";
import { formatDuration, slaStatus, type SlaFields, type SlaPolicy, type SlaStatus } from "../sla";
import type { MortgageSettings } from "./settings";

type Residency = "uae_national" | "uae_resident_expat";
type Employment = "salaried" | "business_owner";
type Service = "pre_approval" | "consultancy";
type TeamRole = "head" | "adviser";

// ── The team ─────────────────────────────────────────────────────

export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  role: TeamRole | null;
  photoUrl: string | null;
};

type StaffRow = {
  user_id: string;
  display_name: string;
  mortgage_role: TeamRole | null;
  photo_url: string | null;
  status?: string;
};

function member(row: StaffRow): TeamMember {
  return {
    id: row.user_id,
    name: row.display_name,
    initials: initialsOf(row.display_name),
    role: row.mortgage_role,
    photoUrl: row.photo_url,
  };
}

/** Everyone active on the mortgage team, the Head first, then by name. */
export async function loadTeam(db: SupabaseClient): Promise<TeamMember[]> {
  const { data, error } = await db
    .from("staff")
    .select("user_id, display_name, mortgage_role, photo_url")
    .eq("status", "active")
    .not("mortgage_role", "is", null)
    .order("display_name");
  if (error) throw new Error(`team read failed: ${error.message}`);
  return (data as StaffRow[])
    .map(member)
    .sort((a, b) => (a.role === b.role ? 0 : a.role === "head" ? -1 : 1));
}

// ── C1 · the queue ───────────────────────────────────────────────

export type DocBarState = "accepted" | "review" | "flagged";

export type ConsultIcon = "clock" | "chat" | "phone" | "mail" | "calendar" | "tick";

/** One row of C1, everything formatted on the server: nothing here needs "now" in the browser. */
export type QueueRow = {
  reference: string;
  fullName: string;
  /** "+971 50 ••• 4417": C1 never sends a full number to the browser. */
  mobile: string;
  service: Service;
  profile: string;
  status: RequestStatus;
  docs: DocBarState[] | null;
  sla: SlaStatus | null;
  /** The promise column of a consultancy row: "Waiting 12m", "Replied on WhatsApp 11:20", "Wed 23 Sep · 11:30". */
  consult: { icon: ConsultIcon; text: string } | null;
  owner: { name: string; initials: string } | null;
  received: string;
};

export type QueueResult = {
  rows: QueueRow[];
  /** Rows matching every filter, across all pages. */
  total: number;
  page: number;
  pageCount: number;
  counts: {
    tabs: Record<QueueTab, number>;
    services: Record<ServiceFilter, number>;
    /** The breadcrumbs' figures: the whole inbox, unfiltered. */
    open: number;
    new: number;
  };
  /** The at-risk banner: every running pre-approval with 4 hours or less left, whatever the filters. */
  atRisk: { reference: string; fullName: string; remaining: string }[];
};

type QueueDbRow = SlaFields & {
  id: string;
  reference: string;
  service: Service;
  status: RequestStatus;
  full_name: string;
  mobile_e164: string;
  residency: Residency;
  employment_type: Employment;
  owner_staff_id: string | null;
  submitted_at: string;
  closed_at: string | null;
  owner: { display_name: string } | null;
  mortgage_documents: { kind: DocKind; state: "to_review" | "accepted" | "reupload_requested" }[];
  mortgage_contact_attempts: Pick<ContactInput, "channel" | "outcome" | "occurred_at">[];
  mortgage_consultations: { starts_at: string; status: string }[];
};

const QUEUE_COLUMNS = `
  id, reference, service, status, full_name, mobile_e164, residency, employment_type,
  owner_staff_id, submitted_at, closed_at,
  sla_started_at, sla_due_at, sla_paused_at, sla_remaining_seconds, sla_stopped_at,
  owner:staff!mortgage_requests_owner_staff_id_fkey(display_name),
  mortgage_documents(kind, state),
  mortgage_contact_attempts(channel, outcome, occurred_at),
  mortgage_consultations(starts_at, status)
`;

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

export const RESIDENCY_KEY: Record<Residency, string> = {
  uae_national: "residency.uaeNational",
  uae_resident_expat: "residency.expat",
};
export const EMPLOYMENT_KEY: Record<Employment, string> = {
  salaried: "employment.salaried",
  business_owner: "employment.businessOwner",
};

function docBar(row: QueueDbRow): DocBarState[] | null {
  if (row.service !== "pre_approval") return null;
  const byKind = new Map(row.mortgage_documents.map((d) => [d.kind, d.state]));
  return DOCUMENT_SETS[row.employment_type].map((kind) => {
    const state = byKind.get(kind);
    return state === "accepted" ? "accepted" : state === "reupload_requested" ? "flagged" : "review";
  });
}

function consultSummary(row: QueueDbRow, now: Date): QueueRow["consult"] {
  if (row.service !== "consultancy") return null;
  if (row.status === "new") {
    const waited = Math.max(0, (now.getTime() - new Date(row.submitted_at).getTime()) / 1000);
    return { icon: "clock", text: t("c1.consult.waiting", { duration: formatDuration(waited) }) };
  }
  if (row.status === "consultation_booked") {
    const booked = row.mortgage_consultations.find((c) => c.status === "booked");
    if (booked) {
      const when = formatBookedAt(booked.starts_at).split(" · ");
      return { icon: "calendar", text: t("c1.consult.booked", { date: when[0] ?? "", time: when[1] ?? "" }) };
    }
  }
  if (row.status === "completed") {
    return { icon: "tick", text: t("c1.consult.completed", { date: formatDayMonth(row.closed_at ?? row.submitted_at) }) };
  }
  const last = row.mortgage_contact_attempts[0];
  if (!last) return { icon: "clock", text: "" };
  const time = formatActivityTime(last.occurred_at, now);
  if (last.outcome === "received") return { icon: "chat", text: t("c1.consult.repliedWhatsapp", { time }) };
  if (last.channel === "whatsapp") return { icon: "chat", text: t("c1.consult.whatsappSent", { time }) };
  if (last.channel === "email") return { icon: "mail", text: t("c1.consult.emailed", { time }) };
  return { icon: "phone", text: t("c1.consult.called", { time }) };
}

function received(value: string, now: Date): string {
  const parts = receivedParts(value, now);
  return parts.kind === "today" ? t("c1.received.today", { time: parts.time }) : parts.text;
}

type Prepared = {
  row: QueueRow;
  mobileE164: string;
  ownerId: string | null;
  submittedAt: string;
  closedAt: string | null;
  bookedAt: string | null;
  lastContactAt: string | null;
};

function prepare(r: QueueDbRow, now: Date, policy: SlaPolicy): Prepared {
  const sla = r.service === "pre_approval" ? slaStatus(r, now, policy) : null;
  const residencyShort = r.residency === "uae_national" ? t("residency.uaeNational") : t("residency.expatShort");
  return {
    row: {
      reference: r.reference,
      fullName: r.full_name,
      mobile: maskMobile(r.mobile_e164),
      service: r.service,
      profile: t("c1.profile", { residency: residencyShort, employment: t(EMPLOYMENT_KEY[r.employment_type]) }),
      status: r.status,
      docs: docBar(r),
      sla,
      consult: consultSummary(r, now),
      owner: r.owner ? { name: r.owner.display_name, initials: initialsOf(r.owner.display_name) } : null,
      received: received(r.submitted_at, now),
    },
    mobileE164: r.mobile_e164,
    ownerId: r.owner_staff_id,
    submittedAt: r.submitted_at,
    closedAt: r.closed_at,
    bookedAt: r.mortgage_consultations.find((c) => c.status === "booked")?.starts_at ?? null,
    lastContactAt: r.mortgage_contact_attempts[0]?.occurred_at ?? null,
  };
}

function matchesOwner(p: Prepared, owner: string, meId: string): boolean {
  if (owner === "anyone") return true;
  if (owner === "me") return p.ownerId === meId;
  if (owner === "unassigned") return p.ownerId === null;
  return p.ownerId === owner;
}

function matchesService(p: Prepared, service: ServiceFilter): boolean {
  return service === "all" || p.row.service === service;
}

/** C1's data for one view (SPEC §4.3; docs/mortgage/cms/C1 "Data"). */
export async function listQueue(
  db: SupabaseClient,
  params: QueueParams & { q: string },
  ctx: { now: Date; meId: string; policy: SlaPolicy },
): Promise<QueueResult> {
  const raw = await allRows<QueueDbRow>((from, to) =>
    db
      .from("mortgage_requests")
      .select(QUEUE_COLUMNS)
      .order("id")
      .order("occurred_at", { referencedTable: "mortgage_contact_attempts", ascending: false })
      .limit(1, { referencedTable: "mortgage_contact_attempts" })
      .in("mortgage_consultations.status", ["booked", "held"])
      .order("starts_at", { referencedTable: "mortgage_consultations", ascending: false })
      .range(from, to) as unknown as PromiseLike<{ data: QueueDbRow[] | null; error: { message: string } | null }>,
  );
  const all = raw.map((r) => prepare(r, ctx.now, ctx.policy));
  const open = all.filter((p) => !CLOSED_STATUSES.includes(p.row.status));

  // Owner and search narrow everything below; tab and service are the axes the counts are for.
  const base = all.filter(
    (p) =>
      matchesOwner(p, params.owner, ctx.meId) &&
      matchesSearch({ fullName: p.row.fullName, reference: p.row.reference, mobile: p.mobileE164 }, params.q),
  );

  const tabs = Object.fromEntries(
    QUEUE_TABS.map((tab) => [tab, base.filter((p) => matchesService(p, params.service) && inTab(p.row.status, tab)).length]),
  ) as Record<QueueTab, number>;
  const services = Object.fromEntries(
    (["all", "pre_approval", "consultancy"] as const).map((s) => [
      s,
      base.filter((p) => matchesService(p, s) && inTab(p.row.status, params.tab)).length,
    ]),
  ) as Record<ServiceFilter, number>;

  const atRisk = open
    .filter((p) => isAtRisk(p.row.sla))
    .sort((a, b) => (a.row.sla!.remainingSeconds ?? 0) - (b.row.sla!.remainingSeconds ?? 0))
    .map((p) => ({
      reference: p.row.reference,
      fullName: p.row.fullName,
      remaining: formatDuration(p.row.sla!.remainingSeconds ?? 0),
    }));

  const visible = base.filter(
    (p) => matchesService(p, params.service) && inTab(p.row.status, params.tab) && (!params.risk || isAtRisk(p.row.sla)),
  );
  if (params.tab === "closed") {
    visible.sort((a, b) => (b.closedAt ?? b.submittedAt).localeCompare(a.closedAt ?? a.submittedAt));
  } else {
    visible.sort((a, b) =>
      promiseDueCompare(
        { service: a.row.service, status: a.row.status, submittedAt: a.submittedAt, sla: a.row.sla, bookedAt: a.bookedAt, lastContactAt: a.lastContactAt },
        { service: b.row.service, status: b.row.status, submittedAt: b.submittedAt, sla: b.row.sla, bookedAt: b.bookedAt, lastContactAt: b.lastContactAt },
      ),
    );
  }

  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, params.page), pageCount);
  return {
    rows: visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => p.row),
    total: visible.length,
    page,
    pageCount,
    counts: {
      tabs,
      services,
      open: open.length,
      new: all.filter((p) => p.row.status === "new").length,
    },
    atRisk,
  };
}

// ── C2 / C6 · one request ────────────────────────────────────────

export type FileView = {
  id: string;
  name: string;
  /** "1 page · 412 KB", "1.4 MB". */
  meta: string;
  image: boolean;
  /** Still being checked: can't be opened yet. */
  scanning: boolean;
};

export type DocumentView = {
  id: string;
  kind: DocKind;
  state: "to_review" | "accepted" | "reupload_requested";
  acceptedBy: string | null;
  files: FileView[];
};

export type ConsultationView = {
  id: string;
  startsAt: string;
  when: string;
  format: "phone" | "video" | "office";
  adviser: TeamMember | null;
  status: "booked" | "held" | "no_show" | "cancelled";
  invited: boolean;
};

export type RequestFile = {
  id: string;
  reference: string;
  service: Service;
  status: RequestStatus;
  /** The optimistic-concurrency token every action sends back. */
  updatedAt: string;
  fullName: string;
  firstName: string;
  dateOfBirth: string;
  /** "14 Mar 1990 · 36". */
  dobAge: string;
  mobile: string;
  mobileDisplay: string;
  email: string;
  residency: Residency;
  employment: Employment;
  /** "UAE Resident / Expat · up to 80% LTV". */
  residencyWithLtv: string;
  startedFrom: string;
  submittedAt: string;
  submittedDisplay: string;
  /** C6's header: "Received today 09:47 · first contact 10:52". */
  receivedLine: string;
  closedAt: string | null;
  sla: SlaStatus | null;
  owner: TeamMember | null;
  documents: DocumentView[];
  consent: {
    given: string;
    wordingVersion: string;
    pendingCompliance: boolean;
    withdrawn: boolean;
  } | null;
  activity: ActivityLine[];
  consultation: ConsultationView | null;
  invite: { sentAt: string; expires: string } | null;
  team: TeamMember[];
  me: { id: string; role: TeamRole };
  can: { act: boolean; reassign: boolean; claim: boolean };
};

type RequestDbRow = SlaFields & {
  id: string;
  reference: string;
  service: Service;
  status: RequestStatus;
  full_name: string;
  date_of_birth: string;
  mobile_e164: string;
  email: string;
  residency: Residency;
  employment_type: Employment;
  entry_point: string;
  owner_staff_id: string | null;
  submitted_at: string;
  first_contact_at: string | null;
  closed_at: string | null;
  updated_at: string;
};

const ENTRY_KEY: Record<string, string> = {
  calculator_preapproval: "entry.calculatorPreapproval",
  calculator_advisor: "entry.calculatorAdvisor",
  home: "entry.home",
  property_detail: "entry.propertyDetail",
  services_menu: "entry.servicesMenu",
  consult_invite: "entry.consultInvite",
  direct: "entry.direct",
};

function fileMeta(f: { mime: string; size_bytes: number; page_count: number | null }): string {
  const size =
    f.size_bytes < 1_048_576 ? `${Math.max(1, Math.round(f.size_bytes / 1024))} KB` : `${(f.size_bytes / 1_048_576).toFixed(1)} MB`;
  if (f.mime !== "application/pdf" || !f.page_count) return size;
  return `${t("viewer.pages", { count: f.page_count })} · ${size}`;
}

/** Everything C2 or C6 shows for one request, or null when there's no such reference. */
export async function getRequestFile(
  db: SupabaseClient,
  reference: string,
  ctx: { now: Date; me: { id: string; role: TeamRole }; policy: SlaPolicy; settings: MortgageSettings },
): Promise<RequestFile | null> {
  if (!/^BZM-\d{2}-\d{4,}$/.test(reference)) return null;
  const { data: found, error } = await db
    .from("mortgage_requests")
    .select(
      "id, reference, service, status, full_name, date_of_birth, mobile_e164, email, residency, employment_type, entry_point, owner_staff_id, submitted_at, first_contact_at, closed_at, updated_at, sla_started_at, sla_due_at, sla_paused_at, sla_remaining_seconds, sla_stopped_at",
    )
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(`request read failed: ${error.message}`);
  if (!found) return null;
  const r = found as RequestDbRow;

  const [documents, consent, events, contacts, consultations, team] = await Promise.all([
    r.service === "pre_approval"
      ? db
          .from("mortgage_documents")
          .select(
            "id, kind, state, accepted_by, accepted_at, files:mortgage_files(id, original_name, mime, size_bytes, page_count, state, scan_status, uploaded_at, period_from)",
          )
          .eq("request_id", r.id)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("mortgage_consents")
      .select("given_at, ip, user_agent, wording_version, withdrawn_at")
      .eq("request_id", r.id)
      .order("given_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("mortgage_events")
      .select("id, type, actor_kind, actor_id, data, created_at")
      .eq("request_id", r.id)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("mortgage_contact_attempts")
      .select("id, staff_id, channel, outcome, body, duration_seconds, occurred_at")
      .eq("request_id", r.id)
      .order("occurred_at", { ascending: false })
      .limit(500),
    db
      .from("mortgage_consultations")
      .select("id, adviser_staff_id, format, starts_at, status, invite_channels")
      .eq("request_id", r.id)
      .order("starts_at", { ascending: false }),
    loadTeam(db),
  ]);
  for (const res of [documents, consent, events, contacts, consultations]) {
    if (res.error) throw new Error(`request file read failed: ${res.error.message}`);
  }

  const eventRows = (events.data ?? []) as EventInput[];
  const contactRows = (contacts.data ?? []) as ContactInput[];

  // Names for everyone the history mentions, including people who have left the team.
  const names = new Map(team.map((m) => [m.id, m.name]));
  const missing = [
    ...staffIdsIn(eventRows, contactRows),
    ...(r.owner_staff_id ? [r.owner_staff_id] : []),
    ...((documents.data ?? []) as { accepted_by: string | null }[]).flatMap((d) => (d.accepted_by ? [d.accepted_by] : [])),
    ...((consultations.data ?? []) as { adviser_staff_id: string }[]).map((c) => c.adviser_staff_id),
  ].filter((id) => !names.has(id));
  const others: TeamMember[] = [];
  if (missing.length) {
    const { data } = await db
      .from("staff")
      .select("user_id, display_name, mortgage_role, photo_url")
      .in("user_id", [...new Set(missing)]);
    for (const row of (data ?? []) as StaffRow[]) {
      names.set(row.user_id, row.display_name);
      others.push(member(row));
    }
  }
  const person = (id: string | null) => (id ? (team.find((m) => m.id === id) ?? others.find((m) => m.id === id) ?? null) : null);

  const sla = r.service === "pre_approval" ? slaStatus(r, ctx.now, ctx.policy) : null;
  const ltv = r.residency === "uae_national" ? ctx.settings.ltv_national_pct : ctx.settings.ltv_expat_pct;

  type DocDb = {
    id: string;
    kind: DocKind;
    state: DocumentView["state"];
    accepted_by: string | null;
    accepted_at: string | null;
    files: {
      id: string;
      original_name: string;
      mime: string;
      size_bytes: number;
      page_count: number | null;
      state: string;
      scan_status: string;
      uploaded_at: string;
      period_from: string | null;
    }[];
  };
  const docRows = (documents.data ?? []) as DocDb[];
  const docViews: DocumentView[] = DOCUMENT_SETS[r.employment_type]
    .map((kind) => docRows.find((d) => d.kind === kind))
    .filter((d): d is DocDb => !!d)
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      state: d.state,
      acceptedBy:
        d.state === "accepted" && d.accepted_by && d.accepted_at
          ? t("c2.docs.acceptedBy", { name: (names.get(d.accepted_by) ?? "").split(/\s+/)[0] ?? "", time: formatTime(d.accepted_at) })
          : null,
      files: d.files
        .filter((f) => f.state === "active")
        // Statements in month order, everything else in the order it was uploaded.
        .sort(
          (a, b) =>
            (a.period_from ?? "").localeCompare(b.period_from ?? "") ||
            a.uploaded_at.localeCompare(b.uploaded_at) ||
            a.original_name.localeCompare(b.original_name),
        )
        .map((f) => ({
          id: f.id,
          name: f.original_name,
          meta: fileMeta(f),
          image: f.mime !== "application/pdf",
          scanning: f.scan_status !== "clean",
        })),
    }));

  type ConsentDb = { given_at: string; ip: string | null; user_agent: string | null; wording_version: string; withdrawn_at: string | null };
  const c = consent.data as ConsentDb | null;
  const consentView = c
    ? (() => {
        const ua = describeUserAgent(c.user_agent);
        return {
          given: t("c2.consent.given", { givenAt: formatDayTime(c.given_at), ip: maskIp(c.ip), browser: ua.browser, os: ua.os }),
          wordingVersion: c.wording_version,
          pendingCompliance: !isConsentVersion(c.wording_version) || PENDING_COMPLIANCE.has(c.wording_version),
          withdrawn: !!c.withdrawn_at,
        };
      })()
    : null;

  type ConsultDb = { id: string; adviser_staff_id: string; format: ConsultationView["format"]; starts_at: string; status: ConsultationView["status"]; invite_channels: string[] };
  const consultRows = (consultations.data ?? []) as ConsultDb[];
  const current = consultRows.find((x) => x.status === "booked") ?? consultRows.find((x) => x.status === "held") ?? null;

  const lastInvite = eventRows.find((e) => e.type === "invite.sent");
  const inviteExpires = typeof lastInvite?.data.expires_at === "string" ? lastInvite.data.expires_at : null;

  const role = ctx.me.role;
  const isOwner = r.owner_staff_id === ctx.me.id;
  const closed = CLOSED_STATUSES.includes(r.status);

  return {
    id: r.id,
    reference: r.reference,
    service: r.service,
    status: r.status,
    updatedAt: r.updated_at,
    fullName: r.full_name,
    firstName: r.full_name.trim().split(/\s+/)[0] ?? r.full_name,
    dateOfBirth: r.date_of_birth,
    dobAge: t("field.dobAge", { date: formatLongDate(r.date_of_birth), age: ageOn(r.date_of_birth, ctx.now) }),
    mobile: r.mobile_e164,
    mobileDisplay: formatMobile(r.mobile_e164),
    email: r.email,
    residency: r.residency,
    employment: r.employment_type,
    residencyWithLtv: t("residency.withLtv", { residency: t(RESIDENCY_KEY[r.residency]), ltv }),
    startedFrom: t(ENTRY_KEY[r.entry_point] ?? "entry.direct"),
    submittedAt: r.submitted_at,
    submittedDisplay: formatDayTime(r.submitted_at),
    receivedLine: r.first_contact_at
      ? t("c6.header.received", { when: formatWhen(r.submitted_at, ctx.now), time: formatTime(r.first_contact_at) })
      : t("c6.header.notContacted", { when: formatWhen(r.submitted_at, ctx.now) }),
    closedAt: r.closed_at,
    sla,
    owner: person(r.owner_staff_id),
    documents: docViews,
    consent: consentView,
    activity: buildActivity(eventRows, contactRows, {
      service: r.service,
      applicantName: r.full_name,
      mobile: r.mobile_e164,
      names,
      now: ctx.now,
    }),
    consultation: current
      ? {
          id: current.id,
          startsAt: current.starts_at,
          when: formatBookedAt(current.starts_at),
          format: current.format,
          adviser: person(current.adviser_staff_id),
          status: current.status,
          invited: current.invite_channels.length > 0,
        }
      : null,
    invite: lastInvite && inviteExpires ? { sentAt: lastInvite.created_at, expires: formatDayMonth(inviteExpires) } : null,
    team,
    me: ctx.me,
    can: {
      act: !closed && (role === "head" || isOwner),
      reassign: role === "head" && !closed,
      claim: !closed && r.owner_staff_id === null,
    },
  };
}

// ── C6 · free slots ──────────────────────────────────────────────

/** An adviser's own hours and their booked consultations over the coming days, for the slot picker. */
export async function loadAdviserCalendar(
  db: SupabaseClient,
  adviserIds: readonly string[],
  from: Date,
): Promise<{
  hours: Record<string, { weekday: number; starts: string; ends: string }[]>;
  bookings: Record<string, { startsAt: string; endsAt: string }[]>;
}> {
  if (adviserIds.length === 0) return { hours: {}, bookings: {} };
  const [hours, bookings] = await Promise.all([
    db.from("mortgage_adviser_hours").select("staff_id, weekday, starts, ends").in("staff_id", [...adviserIds]),
    db
      .from("mortgage_consultations")
      .select("adviser_staff_id, starts_at, ends_at")
      .in("adviser_staff_id", [...adviserIds])
      .eq("status", "booked")
      .gte("ends_at", from.toISOString())
      .order("starts_at"),
  ]);
  if (hours.error) throw new Error(`adviser hours read failed: ${hours.error.message}`);
  if (bookings.error) throw new Error(`bookings read failed: ${bookings.error.message}`);
  const out = {
    hours: {} as Record<string, { weekday: number; starts: string; ends: string }[]>,
    bookings: {} as Record<string, { startsAt: string; endsAt: string }[]>,
  };
  for (const id of adviserIds) {
    out.hours[id] = [];
    out.bookings[id] = [];
  }
  for (const h of (hours.data ?? []) as { staff_id: string; weekday: number; starts: string; ends: string }[]) {
    out.hours[h.staff_id]?.push({ weekday: h.weekday, starts: h.starts, ends: h.ends });
  }
  for (const b of (bookings.data ?? []) as { adviser_staff_id: string; starts_at: string; ends_at: string }[]) {
    out.bookings[b.adviser_staff_id]?.push({ startsAt: b.starts_at, endsAt: b.ends_at });
  }
  return out;
}

