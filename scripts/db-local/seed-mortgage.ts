/**
 * Local seed for the mortgage module — the data the CMS designs show
 * (docs/mortgage/cms): C1's eleven requests, Priya Raman's file (C2, C3), Karim
 * Haddad's re-upload (C4, W8), Ahmed Al Suwaidi's consultation (C6), the bank
 * responses C5 shows, and the mortgage team.
 *
 * Every clock is set relative to now through lib/mortgage-requests/sla.ts, on
 * the working-hours calendar (decision D11), so the queue shows the designed
 * remaining times ("17h 42m left", "Paused · 9h 13m left") whenever it runs.
 * Received times differ from the PNGs, which were drawn on wall-clock time.
 *
 * Deliberate differences from the designs:
 *   · Emails are @example.com, so nothing seeded can ever be mailed to a real
 *     address (the PNGs show gmail/outlook addresses).
 *   · C5's bank responses sit on Arjun Mehta (BZM-26-0398, With banks), not
 *     Priya: C2 needs Priya in review, and one file can't be both.
 *   · Statement file names and periods follow the months required for each
 *     request's submission date, so coverage is consistent with "now".
 *
 * Output is SQL on stdout. scripts/db-local/reset.sh pipes it into the local
 * Docker database; this script connects to nothing itself, so it can't reach
 * production. The staff accounts' password is LOCAL_PASSWORD below — local
 * test credentials only.
 */

import { createHash, randomUUID } from "node:crypto";
import { DOCUMENT_SETS, requiredStatementMonths, type DocKind } from "../../lib/mortgage-requests/documents";
import { CHECKLISTS } from "../../lib/mortgage-requests/checklists";
import { dubaiInstant, dubaiParts, DAY_MS } from "../../lib/mortgage-requests/dubai-time";
import {
  DEFAULT_WORKING_HOURS,
  addWorkingSeconds,
  slaPolicy,
  subtractWorkingSeconds,
} from "../../lib/mortgage-requests/sla";

const LOCAL_PASSWORD = "local-only-mortgage-seed";

const NOW = new Date();
const POLICY = slaPolicy({ sla_budget_minutes: 1440, sla_risk_minutes: 240, working_hours: DEFAULT_WORKING_HOURS });
const CAL = POLICY.calendar;
const H = 3600;
const MIN = 60;
const MB = 1_048_576;

// ── SQL helpers ─────────────────────────────────────────────────

class Raw {
  constructor(readonly sql: string) {}
}
const raw = (sql: string) => new Raw(sql);
type Value = string | number | boolean | null | undefined | Date | Raw | Record<string, unknown> | unknown[];

function lit(value: Value): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Raw) return value.sql;
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
}

const out: string[] = [];
function insert(table: string, rows: Record<string, Value>[]) {
  if (rows.length === 0) return;
  // Every column any row sets; rows without it get null.
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const values = rows.map((row) => `  (${columns.map((c) => lit(row[c])).join(", ")})`);
  out.push(`insert into ${table} (${columns.join(", ")}) values\n${values.join(",\n")};`);
}
const textArray = (items: string[]) => raw(`array[${items.map((i) => lit(i)).join(", ")}]::text[]`);

// ── Time helpers ────────────────────────────────────────────────

const minutesAgo = (m: number) => new Date(NOW.getTime() - m * MIN * 1000);
const plusMinutes = (at: Date, m: number) => new Date(at.getTime() + m * MIN * 1000);
/** Never let a derived event land in the future. */
const notAfterNow = (at: Date) => (at.getTime() > NOW.getTime() - MIN * 1000 ? minutesAgo(1) : at);

/** The next day after today (Dubai) on which `hour:minute` falls inside working hours. */
function nextWorkingDayAt(hour: number, minute: number): Date {
  for (let ahead = 1; ahead < 14; ahead++) {
    const day = dubaiParts(new Date(NOW.getTime() + ahead * DAY_MS));
    const at = dubaiInstant(day.year, day.month, day.day, hour, minute);
    const minuteOfDay = hour * 60 + minute;
    if (CAL.week[day.weekday].some((w) => w.start <= minuteOfDay && minuteOfDay + 20 <= w.end)) return at;
  }
  throw new Error("no working day in the next two weeks");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (ym: string) => Number(ym.slice(5, 7)) - 1;
const yearOf = (ym: string) => ym.slice(0, 4);
const firstDay = (ym: string) => `${ym}-01`;
function lastDay(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// ── The team ────────────────────────────────────────────────────

type StaffKey = "yasmin" | "rashid" | "leena" | "mariam";
const STAFF: Record<StaffKey, { id: string; name: string; slug: string; title: string; role: string; mortgageRole: "head" | "adviser" | null; email: string }> = {
  yasmin: { id: "5eed0000-0000-4000-8000-000000000001", name: "Yasmin Abdalla", slug: "yasmin-abdalla", title: "Head of mortgages", role: "support", mortgageRole: "head", email: "yasmin.abdalla@example.com" },
  rashid: { id: "5eed0000-0000-4000-8000-000000000002", name: "Rashid Khan", slug: "rashid-khan", title: "Mortgage adviser", role: "support", mortgageRole: "adviser", email: "rashid.khan@example.com" },
  leena: { id: "5eed0000-0000-4000-8000-000000000003", name: "Leena Varghese", slug: "leena-varghese", title: "Mortgage adviser", role: "support", mortgageRole: "adviser", email: "leena.varghese@example.com" },
  // The generic admin in the PNGs' shell: no mortgage role, so the module is closed to her (SPEC §7).
  mariam: { id: "5eed0000-0000-4000-8000-000000000004", name: "Mariam Al-Hashimi", slug: "mariam-al-hashimi", title: "Admin", role: "admin", mortgageRole: null, email: "mariam.alhashimi@example.com" },
};

insert(
  "auth.users",
  Object.values(STAFF).map((s) => ({
    instance_id: "00000000-0000-0000-0000-000000000000",
    id: s.id,
    aud: "authenticated",
    role: "authenticated",
    email: s.email,
    encrypted_password: raw(`extensions.crypt(${lit(LOCAL_PASSWORD)}, extensions.gen_salt('bf'))`),
    email_confirmed_at: NOW,
    raw_app_meta_data: { provider: "email", providers: ["email"] },
    raw_user_meta_data: { name: s.name },
    created_at: NOW,
    updated_at: NOW,
    confirmation_token: "",
    recovery_token: "",
    email_change: "",
    email_change_token_new: "",
  })),
);
insert(
  "auth.identities",
  Object.values(STAFF).map((s) => ({
    id: randomUUID(),
    user_id: s.id,
    provider_id: s.id,
    provider: "email",
    identity_data: { sub: s.id, email: s.email, email_verified: true },
    last_sign_in_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  })),
);
insert(
  "public.staff",
  Object.values(STAFF).map((s) => ({
    user_id: s.id,
    display_name: s.name,
    slug: s.slug,
    title: s.title,
    role: s.role,
    status: "active",
    mortgage_role: s.mortgageRole,
  })),
);
insert(
  "public.mortgage_adviser_hours",
  (["yasmin", "rashid", "leena"] as const).flatMap((key) =>
    Object.entries(DEFAULT_WORKING_HOURS).flatMap(([weekday, windows]) =>
      windows.map(([starts, ends]) => ({ staff_id: STAFF[key].id, weekday: Number(weekday), starts, ends })),
    ),
  ),
);

// ── Partner banks (C5) ──────────────────────────────────────────

const BANKS = {
  FAB: { id: randomUUID(), name: "First Abu Dhabi Bank", color: "oklch(0.42 0.06 250)" },
  ADCB: { id: randomUUID(), name: "Abu Dhabi Commercial Bank", color: "oklch(0.45 0.09 25)" },
  MSQ: { id: randomUUID(), name: "Mashreq", color: "oklch(0.45 0.08 320)" },
};
insert(
  "public.mortgage_partner_banks",
  Object.entries(BANKS).map(([code, bank], i) => ({
    id: bank.id,
    code,
    name: bank.name,
    brand_color: bank.color,
    active: true,
    package_emails: textArray([`${code.toLowerCase()}-packages@example.com`]),
    sort_order: i,
  })),
);

// ── Requests (C1) ───────────────────────────────────────────────

out.push("select set_config('mortgage.transition', 'on', true);");

type DocMark = "accepted" | "review" | "flagged";
type PreSeed = {
  ref: string; name: string; mobile: string; email: string; dob: string;
  residency: "uae_national" | "uae_resident_expat"; employment: "salaried" | "business_owner";
  status: "new" | "in_review" | "awaiting_applicant" | "with_banks";
  docs: [DocMark, DocMark, DocMark, DocMark];
  remaining: number; paused?: boolean; owner: StaffKey | null;
  entry: string;
};

const PRE_APPROVALS: PreSeed[] = [
  { ref: "BZM-26-0406", name: "Mariam Al Kaabi", mobile: "+971504813321", email: "mariam.alkaabi@example.com", dob: "1984-06-02", residency: "uae_national", employment: "business_owner", status: "in_review", docs: ["accepted", "accepted", "review", "review"], remaining: H + 48 * MIN, owner: "leena", entry: "home" },
  { ref: "BZM-26-0403", name: "Thomas Becker", mobile: "+971523067710", email: "thomas.becker@example.com", dob: "1979-01-19", residency: "uae_resident_expat", employment: "salaried", status: "in_review", docs: ["accepted", "accepted", "accepted", "review"], remaining: 3 * H + 20 * MIN, owner: "rashid", entry: "calculator_preapproval" },
  { ref: "BZM-26-0398", name: "Arjun Mehta", mobile: "+971559120142", email: "arjun.mehta@example.com", dob: "1987-09-11", residency: "uae_resident_expat", employment: "salaried", status: "with_banks", docs: ["accepted", "accepted", "accepted", "accepted"], remaining: 4 * H + 30 * MIN, owner: "yasmin", entry: "property_detail" },
  { ref: "BZM-26-0404", name: "Liam Walsh", mobile: "+971586309021", email: "liam.walsh@example.com", dob: "1991-02-27", residency: "uae_resident_expat", employment: "salaried", status: "with_banks", docs: ["accepted", "accepted", "accepted", "accepted"], remaining: 9 * H + 15 * MIN, owner: "rashid", entry: "home" },
  { ref: "BZM-26-0409", name: "Karim Haddad", mobile: "+971557412290", email: "karim.haddad@example.com", dob: "1982-12-05", residency: "uae_resident_expat", employment: "business_owner", status: "awaiting_applicant", docs: ["accepted", "accepted", "accepted", "flagged"], remaining: 9 * H + 13 * MIN, paused: true, owner: "yasmin", entry: "calculator_preapproval" },
  { ref: "BZM-26-0412", name: "Priya Raman", mobile: "+971502184417", email: "priya.raman@example.com", dob: "1990-03-14", residency: "uae_resident_expat", employment: "salaried", status: "in_review", docs: ["accepted", "accepted", "review", "review"], remaining: 17 * H + 42 * MIN, owner: "yasmin", entry: "calculator_preapproval" },
  { ref: "BZM-26-0416", name: "Daniel Okafor", mobile: "+971568806604", email: "daniel.okafor@example.com", dob: "1993-07-30", residency: "uae_resident_expat", employment: "business_owner", status: "new", docs: ["review", "review", "review", "review"], remaining: 21 * H + 5 * MIN, owner: null, entry: "home" },
  { ref: "BZM-26-0417", name: "Sofia Marques", mobile: "+971509938836", email: "sofia.marques@example.com", dob: "1995-04-08", residency: "uae_resident_expat", employment: "salaried", status: "new", docs: ["review", "review", "review", "review"], remaining: 22 * H + 41 * MIN, owner: null, entry: "calculator_preapproval" },
];

const CONSENT_V = "v0.1";
const CONSENT_TEXT =
  "I authorise Bazar Real Estate to share these documents with its partner banks for the sole purpose of obtaining my mortgage pre-approval.";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";

const requests: Record<string, Value>[] = [];
const documents: Record<string, Value>[] = [];
const consents: Record<string, Value>[] = [];
const submissions: Record<string, Value>[] = [];
const files: Record<string, Value>[] = [];
const links: Record<string, Value>[] = [];
const reuploads: Record<string, Value>[] = [];
const attempts: Record<string, Value>[] = [];
const consultations: Record<string, Value>[] = [];
const events: Record<string, Value>[] = [];

const event = (requestId: string, at: Date, type: string, actor: "applicant" | "staff" | "system" | "bank", actorId: string | null, data: Record<string, unknown> = {}) =>
  events.push({ request_id: requestId, actor_kind: actor, actor_id: actorId, type, data, created_at: notAfterNow(at) });

function fileRow(
  documentId: string | null,
  kind: DocKind | null,
  name: string,
  sizeBytes: number,
  pages: number | null,
  mime: string,
  uploadedAt: Date,
  period?: [string, string],
  bankSubmissionId?: string,
) {
  const id = randomUUID();
  files.push({
    id,
    document_id: documentId,
    bank_submission_id: bankSubmissionId ?? null,
    kind,
    state: "active",
    storage_key: `f/${id}`,
    original_name: name,
    mime,
    size_bytes: Math.round(sizeBytes),
    page_count: pages,
    scan_status: "clean",
    period_from: period?.[0] ?? null,
    period_to: period?.[1] ?? null,
    upload_round: 0,
    uploaded_at: uploadedAt,
  });
}

/** The files a document carries, named as the designs name them. */
function seedFiles(documentId: string, kind: DocKind, submittedAt: Date, who: PreSeed) {
  const months = requiredStatementMonths(kind, submittedAt);
  switch (kind) {
    case "emirates_id":
      // Front first, as the applicant picked them: the CMS lists a document's files in upload order.
      fileRow(documentId, kind, "emirates-id-front.jpg", 1.4 * MB, null, "image/jpeg", new Date(submittedAt.getTime() - 60_000));
      fileRow(documentId, kind, "emirates-id-back.jpg", 1.3 * MB, null, "image/jpeg", new Date(submittedAt.getTime() - 30_000));
      return;
    case "passport":
      fileRow(documentId, kind, who.employment === "business_owner" ? "passport-photo-page.pdf" : "passport.pdf", 2.2 * MB, 1, "application/pdf", submittedAt);
      return;
    case "salary_certificate":
      fileRow(documentId, kind, "salary-certificate.pdf", 412 * 1024, 1, "application/pdf", submittedAt);
      return;
    case "trade_license":
      fileRow(documentId, kind, "trade-license.pdf", 0.9 * MB, 1, "application/pdf", submittedAt);
      return;
    case "bank_statements_3m":
      months.forEach((ym, i) =>
        fileRow(documentId, kind, `statement-${MONTHS[monthOf(ym)].toLowerCase()}-${yearOf(ym)}.pdf`, [1.5, 1.6, 1.7][i] * MB, [2, 2, 3][i], "application/pdf", submittedAt, [firstDay(ym), lastDay(ym)]),
      );
      return;
    case "bank_statements_12m": {
      // Karim's three files cover the first nine of the twelve months (C4, W8).
      const chunks = [months.slice(0, 3), months.slice(3, 6), months.slice(6, 9)];
      const covered = who.docs[3] === "flagged" ? chunks : [...chunks, months.slice(9, 12)];
      covered.forEach((chunk, i) => {
        const from = chunk[0];
        const to = chunk[chunk.length - 1];
        const name = `statement-${MONTHS[monthOf(from)].toLowerCase()}-${MONTHS[monthOf(to)].toLowerCase()}-${yearOf(to)}.pdf`;
        fileRow(documentId, kind, name, [6.4, 5.9, 6.1, 6.0][i] * MB, [6, 6, 7, 6][i], "application/pdf", submittedAt, [firstDay(from), lastDay(to)]);
      });
      return;
    }
  }
}

for (const seed of PRE_APPROVALS) {
  const requestId = randomUUID();
  const owner = seed.owner ? STAFF[seed.owner] : null;

  // Clocks: running requests fall due `remaining` of working time from now;
  // Karim's froze at 9h 13m when the re-upload went out, 4h 40m of working time ago (W8: 11:52 vs 16:32).
  let submittedAt: Date;
  let dueAt: Date | null;
  let pausedAt: Date | null = null;
  if (seed.paused) {
    pausedAt = subtractWorkingSeconds(NOW, 4 * H + 40 * MIN, CAL);
    const dueBeforePause = addWorkingSeconds(pausedAt, seed.remaining, CAL);
    submittedAt = subtractWorkingSeconds(dueBeforePause, POLICY.budgetSeconds, CAL);
    dueAt = null;
  } else {
    dueAt = addWorkingSeconds(NOW, seed.remaining, CAL);
    submittedAt = subtractWorkingSeconds(dueAt, POLICY.budgetSeconds, CAL);
  }

  requests.push({
    id: requestId,
    reference: seed.ref,
    service: "pre_approval",
    status: seed.status,
    full_name: seed.name,
    date_of_birth: seed.dob,
    mobile_e164: seed.mobile,
    email: seed.email,
    residency: seed.residency,
    employment_type: seed.employment,
    entry_point: seed.entry,
    owner_staff_id: owner?.id ?? null,
    assigned_at: owner ? plusMinutes(submittedAt, 17) : null,
    submitted_at: submittedAt,
    sla_started_at: submittedAt,
    sla_due_at: dueAt,
    sla_paused_at: pausedAt,
    sla_remaining_seconds: seed.paused ? seed.remaining : null,
    created_at: submittedAt,
  });

  consents.push({
    request_id: requestId,
    wording_version: CONSENT_V,
    wording_text: CONSENT_TEXT,
    given_at: submittedAt,
    ip: seed.ref === "BZM-26-0412" ? "94.203.12.34" : "86.98.54.21",
    user_agent: UA,
  });

  event(requestId, submittedAt, "request.submitted", "applicant", null, { service: "pre_approval", entry_point: seed.entry });
  if (owner) event(requestId, plusMinutes(submittedAt, 17), "owner.assigned", "system", null, { owner_staff_id: owner.id, via: "round_robin" });
  if (seed.status !== "new" && owner) {
    event(requestId, plusMinutes(submittedAt, 19), "document.viewed", "staff", owner.id, { kind: "emirates_id" });
    event(requestId, plusMinutes(submittedAt, 19), "status.changed", "system", null, { from: "new", to: "in_review", event: "first_document_opened" });
  }

  const kinds = DOCUMENT_SETS[seed.employment];
  kinds.forEach((kind, i) => {
    const documentId = randomUUID();
    const mark = seed.docs[i];
    const acceptedAt = plusMinutes(submittedAt, 21 + i * 3);
    const allTicked = Object.fromEntries(CHECKLISTS[kind].checks.map((c) => [c.key, true]));
    let checks: Record<string, boolean> = mark === "accepted" ? allTicked : {};
    let recorded: Record<string, unknown> = {};

    if (kind === "salary_certificate" && (mark === "accepted" || seed.ref === "BZM-26-0412")) {
      // C3: Priya's certificate has every check ticked and the pricing figures in, one click from Accept.
      checks = allTicked;
      recorded = {
        monthly_gross_aed: seed.ref === "BZM-26-0412" ? 32500 : 41000,
        employed_since: seed.ref === "BZM-26-0412" ? "2019-04" : "2017-09",
        employer: seed.ref === "BZM-26-0412" ? "Corniche Medical Centre L.L.C." : "Gulf Crescent Holdings L.L.C.",
        issued_on: new Date(NOW.getTime() - 8 * DAY_MS).toISOString().slice(0, 10),
        addressed_to: "First Abu Dhabi Bank",
      };
    }
    if (kind === "bank_statements_12m" && mark === "flagged") {
      // C4: the holder and issuer checks pass; the year isn't covered.
      checks = { holder_matches: true, issued_by_bank: true, covers_period: false };
      recorded = { account_holder: "Haddad Trading L.L.C." };
    }

    documents.push({
      id: documentId,
      request_id: requestId,
      kind,
      state: mark === "accepted" ? "accepted" : mark === "flagged" ? "reupload_requested" : "to_review",
      checks,
      recorded,
      accepted_by: mark === "accepted" && owner ? owner.id : null,
      accepted_at: mark === "accepted" ? notAfterNow(acceptedAt) : null,
    });
    seedFiles(documentId, kind, submittedAt, seed);

    if (mark === "accepted" && owner) {
      event(requestId, acceptedAt, "document.accepted", "staff", owner.id, { kind });
    }

    if (mark === "flagged" && pausedAt && owner) {
      // Karim's re-upload request, and the secure link W8 opens.
      const months = requiredStatementMonths(kind, submittedAt);
      const linkId = randomUUID();
      links.push({
        id: linkId,
        request_id: requestId,
        purpose: "reupload",
        document_id: documentId,
        // Local test link: /mortgages/r/karim-local-reupload. Hashing to be settled in Phase 5.
        token_hash: createHash("sha256").update("karim-local-reupload").digest("hex"),
        expires_at: new Date(pausedAt.getTime() + 7 * DAY_MS),
        created_by: owner.id,
        created_at: pausedAt,
      });
      const received = `${MONTHS_LONG[monthOf(months[0])]} ${yearOf(months[0])} to ${MONTHS_LONG[monthOf(months[8])]} ${yearOf(months[8])}`;
      const missing = months.slice(9);
      const missingText = `${MONTHS_LONG[monthOf(missing[0])]}, ${MONTHS_LONG[monthOf(missing[1])]} and ${MONTHS_LONG[monthOf(missing[2])]} ${yearOf(missing[2])}`;
      reuploads.push({
        request_id: requestId,
        document_id: documentId,
        reason: "period_incomplete",
        message: `Your statements cover ${received}. For a full year, please add ${missingText}.`,
        channels: textArray(["whatsapp", "email"]),
        requested_by: owner.id,
        requested_at: pausedAt,
        access_link_id: linkId,
      });
      event(requestId, pausedAt, "reupload.requested", "staff", owner.id, { kind, reason: "period_incomplete" });
      event(requestId, pausedAt, "status.changed", "staff", owner.id, { from: "in_review", to: "awaiting_applicant", event: "reupload_requested" });
    }
  });

  // Priya's latest activity (C2): Yasmin opened the salary certificate eleven minutes ago.
  if (seed.ref === "BZM-26-0412" && owner) {
    event(requestId, minutesAgo(11), "document.viewed", "staff", owner.id, { kind: "salary_certificate" });
  }

  if (seed.status === "with_banks" && owner) {
    const sentAt = plusMinutes(submittedAt, 51);
    const isArjun = seed.ref === "BZM-26-0398";
    for (const [code, bank] of Object.entries(BANKS)) {
      const submissionId = randomUUID();
      const offer =
        isArjun && code === "FAB"
          ? { amount: 2_150_000, rate: 3.99, respondedAfter: 86 }
          : isArjun && code === "ADCB"
            ? { amount: 2_000_000, rate: 4.15, respondedAfter: 57 }
            : null;
      const respondedAt = offer ? notAfterNow(plusMinutes(sentAt, offer.respondedAfter)) : null;
      submissions.push({
        id: submissionId,
        request_id: requestId,
        bank_id: bank.id,
        status: offer ? "pre_approved" : "sent",
        sent_at: notAfterNow(sentAt),
        sent_by: owner.id,
        package_manifest: { documents: kinds, summary: true },
        package_token_hash: createHash("sha256").update(`${seed.ref}-${code}-package`).digest("hex"),
        package_expires_at: new Date(sentAt.getTime() + 7 * DAY_MS),
        responded_at: respondedAt,
        recorded_by: offer ? owner.id : null,
        max_amount_aed: offer?.amount ?? null,
        rate_pct: offer?.rate ?? null,
        rate_type: offer ? "fixed" : null,
        fixed_years: offer ? 3 : null,
        valid_until: offer ? new Date(NOW.getTime() + 60 * DAY_MS).toISOString().slice(0, 10) : null,
      });
      if (offer && code === "FAB") {
        fileRow(null, null, `FAB-pre-approval-${seed.ref}.pdf`, 0.3 * MB, 2, "application/pdf", respondedAt ?? NOW, undefined, submissionId);
      }
      if (offer && respondedAt) {
        event(requestId, respondedAt, "bank.response_recorded", "staff", owner.id, { bank: code, status: "pre_approved" });
      }
    }
    event(requestId, sentAt, "bank.package_sent", "staff", owner.id, { banks: Object.keys(BANKS), documents: kinds.length });
    event(requestId, sentAt, "status.changed", "staff", owner.id, { from: "in_review", to: "with_banks", event: "sent_to_banks" });
  }
}

// ── Consultancy (C1, C6) ────────────────────────────────────────

type ConsultSeed = {
  ref: string; name: string; mobile: string; email: string; dob: string;
  residency: "uae_national" | "uae_resident_expat"; employment: "salaried" | "business_owner";
  status: "new" | "contacted" | "consultation_booked"; owner: StaffKey | null; entry: string; receivedMinutesAgo: number;
};

const CONSULTATIONS: ConsultSeed[] = [
  { ref: "BZM-26-0418", name: "Omar Al Hammadi", mobile: "+971506621178", email: "omar.alhammadi@example.com", dob: "1989-10-21", residency: "uae_national", employment: "salaried", status: "new", owner: null, entry: "services_menu", receivedMinutesAgo: 12 },
  { ref: "BZM-26-0415", name: "Ahmed Al Suwaidi", mobile: "+971507741290", email: "ahmed.suwaidi@example.com", dob: "1986-11-02", residency: "uae_national", employment: "salaried", status: "contacted", owner: "rashid", entry: "calculator_advisor", receivedMinutesAgo: 6 * 60 + 45 },
  { ref: "BZM-26-0401", name: "Noura Al Mansoori", mobile: "+971505545513", email: "noura.almansoori@example.com", dob: "1992-05-16", residency: "uae_national", employment: "business_owner", status: "consultation_booked", owner: "leena", entry: "services_menu", receivedMinutesAgo: 29 * 60 + 30 },
];

for (const seed of CONSULTATIONS) {
  const requestId = randomUUID();
  const owner = seed.owner ? STAFF[seed.owner] : null;
  const receivedAt = minutesAgo(seed.receivedMinutesAgo);
  const firstContactAt = seed.status === "new" ? null : plusMinutes(receivedAt, 65);

  requests.push({
    id: requestId,
    reference: seed.ref,
    service: "consultancy",
    status: seed.status,
    full_name: seed.name,
    date_of_birth: seed.dob,
    mobile_e164: seed.mobile,
    email: seed.email,
    residency: seed.residency,
    employment_type: seed.employment,
    entry_point: seed.entry,
    owner_staff_id: owner?.id ?? null,
    assigned_at: owner ? receivedAt : null,
    submitted_at: receivedAt,
    first_contact_at: firstContactAt,
    sla_started_at: null,
    sla_due_at: null,
    sla_paused_at: null,
    sla_remaining_seconds: null,
    created_at: receivedAt,
  });

  event(requestId, receivedAt, "request.submitted", "applicant", null, { service: "consultancy", entry_point: seed.entry });
  if (owner) event(requestId, receivedAt, "owner.assigned", "system", null, { owner_staff_id: owner.id, via: "round_robin" });

  if (owner && firstContactAt) {
    // C6's contact log: a missed call, a WhatsApp, and the applicant's reply.
    attempts.push(
      { request_id: requestId, staff_id: owner.id, channel: "call", outcome: "no_answer", body: null, duration_seconds: 32, occurred_at: firstContactAt },
      { request_id: requestId, staff_id: owner.id, channel: "whatsapp", outcome: "sent", body: `Hi ${seed.name.split(" ")[0]}, this is ${owner.name.split(" ")[0]} from Bazar Mortgages. Thanks for your consultation request. When suits you for a 20-minute call?`, duration_seconds: null, occurred_at: plusMinutes(receivedAt, 67) },
      { request_id: requestId, staff_id: null, channel: "whatsapp", outcome: "received", body: `Thanks ${owner.name.split(" ")[0]}. Tomorrow morning works, any time before 12.`, duration_seconds: null, occurred_at: notAfterNow(plusMinutes(receivedAt, 93)) },
    );
    event(requestId, firstContactAt, "contact.logged", "staff", owner.id, { channel: "call", outcome: "no_answer" });
    event(requestId, firstContactAt, "status.changed", "staff", owner.id, { from: "new", to: "contacted", event: "contact_logged" });
    event(requestId, plusMinutes(receivedAt, 67), "contact.logged", "staff", owner.id, { channel: "whatsapp", outcome: "sent" });
    event(requestId, plusMinutes(receivedAt, 93), "contact.logged", "applicant", null, { channel: "whatsapp", outcome: "received" });
  }

  if (seed.status === "consultation_booked" && owner) {
    const startsAt = nextWorkingDayAt(11, 30);
    consultations.push({
      request_id: requestId,
      adviser_staff_id: owner.id,
      format: "video",
      starts_at: startsAt,
      duration_minutes: 20,
      ends_at: plusMinutes(startsAt, 20),
      invite_channels: textArray(["email", "whatsapp"]),
      status: "booked",
      created_by: owner.id,
      created_at: plusMinutes(receivedAt, 150),
    });
    event(requestId, plusMinutes(receivedAt, 150), "consultation.booked", "staff", owner.id, { format: "video" });
    event(requestId, plusMinutes(receivedAt, 150), "status.changed", "staff", owner.id, { from: "contacted", to: "consultation_booked", event: "consultation_booked" });
  }
}

insert("public.mortgage_requests", requests);
insert("public.mortgage_documents", documents);
insert("public.mortgage_consents", consents);
insert("public.mortgage_bank_submissions", submissions);
insert("public.mortgage_files", files);
insert("public.mortgage_access_links", links);
insert("public.mortgage_reupload_requests", reuploads);
insert("public.mortgage_contact_attempts", attempts);
insert("public.mortgage_consultations", consultations);
insert("public.mortgage_events", events);

out.push("select set_config('mortgage.transition', 'off', true);");

// The next reference after the designs' last one, BZM-26-0418.
out.push(
  "insert into public.mortgage_reference_counters (yy, last_number) values (26, 418) " +
    "on conflict (yy) do update set last_number = greatest(public.mortgage_reference_counters.last_number, 418);",
);
out.push(
  `update public.mortgage_settings set round_robin_last_staff_id = ${lit(STAFF.leena.id)} where id = 1;`,
);

process.stdout.write(
  `-- Generated by scripts/db-local/seed-mortgage.ts at ${NOW.toISOString()} — local only.\nbegin;\n${out.join("\n\n")}\ncommit;\n`,
);
