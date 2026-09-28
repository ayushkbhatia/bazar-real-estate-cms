import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Eye, Send } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Glyph } from "@/components/mortgage/glyphs";
import { Button } from "@/components/ui/button";
import { DOC_LABEL_KEY } from "@/lib/mortgage-requests/activity";
import { formatWeekdayDate, formatWhen } from "@/lib/mortgage-requests/cms-format";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import type { DocKind } from "@/lib/mortgage-requests/documents";
import { dubaiDayStart, dubaiInstant, dubaiWeekday } from "@/lib/mortgage-requests/dubai-time";
import { nextWorkingDays, slotsForDay, windowsFromAdviserHours, windowsFromSetting, type Slot } from "@/lib/mortgage-requests/slots";
import { getMortgageRole, requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";
import {
  EMPLOYMENT_KEY,
  getRequestFile,
  loadAdviserCalendar,
  RESIDENCY_KEY,
  type RequestFile,
} from "@/lib/mortgage-requests/server/cms-queries";
import { loadMortgageSettings, type LoadedSettings } from "@/lib/mortgage-requests/server/settings";
import { cn } from "@/lib/utils";
import {
  ActivityCard,
  BookingCard,
  BookScrollButton,
  ClaimButton,
  ContactAttemptBar,
  ContactButtons,
  EditApplicantDialog,
  FileRefresher,
  HeldButton,
  InviteButton,
  ReassignDialog,
  type BookingDay,
  type Target,
} from "../_components/file-actions";
import {
  ActivityList,
  Card,
  DocTile,
  DocumentBar,
  FILE_TAG,
  FileHeader,
  FileTagBody,
  KeyValueList,
  OwnerAvatar,
  Pill,
  PromiseClock,
  roleLabel,
  StageRail,
  StatusPill,
} from "../_components/ui";

export const dynamic = "force-dynamic";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

const DOC_HINT_KEY: Record<DocKind, string> = {
  emirates_id: "docHint.emiratesId",
  passport: "docHint.passport",
  salary_certificate: "docHint.salaryCertificate",
  bank_statements_3m: "docHint.bankStatements3m",
  trade_license: "docHint.tradeLicense",
  bank_statements_12m: "docHint.bankStatements12m",
};

const DOC_STATE = {
  to_review: { key: "docState.toReview", tone: "warn", tile: "review" },
  accepted: { key: "docState.accepted", tone: "success", tile: "done" },
  reupload_requested: { key: "docState.reuploadRequested", tone: "danger", tile: "error" },
} as const;

/** The logged file route (Phase 2): every open writes an event before a byte is sent. */
const fileHref = (id: string) => `/api/admin/mortgages/files/${id}`;

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  if (!(await getMortgageRole())) return {};
  const { reference } = await params;
  return { title: decodeURIComponent(reference) };
}

/** C2 · Pre-approval file, or C6 · Consultancy request: the request's service decides. */
export default async function MortgageRequestPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const { user, role, supabase } = await requireMortgageRole();
  const loaded = await loadMortgageSettings(supabase);
  const now = new Date();
  const file = await getRequestFile(supabase, decodeURIComponent(reference), {
    now,
    me: { id: user.id, role },
    policy: loaded.policy,
    settings: loaded.settings,
  });
  if (!file) notFound();

  const target: Target = { requestId: file.id, reference: file.reference, updatedAt: file.updatedAt };
  const breadcrumbs = (
    <>
      {cmsT("nav.group")} › <Link href="/admin/mortgages">{cmsT("nav.mortgages")}</Link> ›{" "}
      <span className="mono">{file.reference}</span>
    </>
  );

  if (file.service === "consultancy") {
    const booking = await bookingData(supabase, file, loaded, now);
    return <Consultancy file={file} target={target} breadcrumbs={breadcrumbs} booking={booking} now={now} />;
  }
  return <PreApproval file={file} target={target} breadcrumbs={breadcrumbs} />;
}

// ── C2 ───────────────────────────────────────────────────────────

const PRE_STAGES = ["status.new", "status.inReview", "status.withBanks", "status.preApproved"];
const PRE_AT: Partial<Record<RequestFile["status"], number>> = {
  new: 0,
  in_review: 1,
  // CMS-12 proposal: In review stays current while the file waits on the
  // applicant; the header's pill says so.
  awaiting_applicant: 1,
  with_banks: 2,
  pre_approved: 3,
  declined: 3,
};

function PreApproval({ file, target, breadcrumbs }: { file: RequestFile; target: Target; breadcrumbs: React.ReactNode }) {
  const accepted = file.documents.filter((d) => d.state === "accepted").length;
  const total = file.documents.length;
  const firstToReview = file.documents.find((d) => d.state !== "accepted")?.id;
  const stages = PRE_STAGES.map((k, i) => (i === 3 && file.status === "declined" ? t("status.declined") : t(k)));
  const acceptTitle = accepted < total ? t("c2.docs.accepted", { accepted, total }) : t("common.soonBanks");

  return (
    <CmsShell
      title={file.fullName}
      breadcrumbs={breadcrumbs}
      secondary={
        // Disabled buttons take no pointer events, so the reason sits on a wrapper.
        <span title={t("common.soonViewer")} className="cursor-not-allowed">
          <Button variant="outline" className="text-[13px]" disabled>
            <Send strokeWidth={1.6} />
            {t("c2.action.requestDocuments")}
          </Button>
        </span>
      }
      primary={
        // Enabled at 4 of 4 with consent on file, once bank sending exists (Phase 6).
        <span title={acceptTitle} className="cursor-not-allowed">
          <Button className="pointer-events-none text-[13px] opacity-40" disabled aria-describedby="accept-why">
            <Check strokeWidth={2} />
            {t("c2.action.acceptApplication")}
          </Button>
          <span id="accept-why" className="sr-only">
            {acceptTitle}
          </span>
        </span>
      }
    >
      <FileRefresher />
      <FileHeader
        chips={[
          { label: t("service.preApproval"), tone: "ink" },
          { label: t(EMPLOYMENT_KEY[file.employment]) },
          { label: file.residencyWithLtv },
        ]}
        right={
          <span className="flex items-center gap-3">
            {file.status === "awaiting_applicant" || file.status === "declined" ? <StatusPill status={file.status} /> : null}
            {file.sla ? <PromiseClock sla={file.sla} width={300} showDue /> : null}
          </span>
        }
      />
      <StageRail stages={stages} at={PRE_AT[file.status] ?? 0} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <section className="overflow-hidden rounded-[10px] border border-bz-border bg-bz-surface">
            <div className="flex items-center gap-3.5 px-5 py-3.5">
              <div className="flex-1">
                <h2 className="text-[14px] font-medium">{t("c2.docs.title", { employment: t(EMPLOYMENT_KEY[file.employment]) })}</h2>
                <p className="mt-0.5 text-[12px] text-bz-muted">{t("c2.docs.uploaded", { submittedAt: file.submittedDisplay })}</p>
              </div>
              <DocumentBar
                states={file.documents.map((d) => (d.state === "accepted" ? "accepted" : d.state === "reupload_requested" ? "flagged" : "review"))}
                label={t("c2.docs.accepted", { accepted, total })}
              />
            </div>
            <ul>
              {file.documents.map((d) => {
                const state = DOC_STATE[d.state];
                const firstFile = d.files.find((f) => !f.scanning);
                const name = t(DOC_LABEL_KEY[d.kind]);
                return (
                  <li
                    key={d.id}
                    className={cn(
                      "grid grid-cols-[40px_minmax(0,1fr)_auto] items-start gap-4 border-t border-bz-border px-5 py-4",
                      d.state === "reupload_requested" && "bg-[oklch(0.985_0.008_28)]",
                    )}
                  >
                    <DocTile kind={d.kind} state={state.tile} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-[14px] font-medium">{name}</h3>
                        <Pill tone={state.tone} small>
                          {t(state.key)}
                        </Pill>
                      </div>
                      <p className="mt-[3px] text-[12px] text-bz-muted">
                        {t(DOC_HINT_KEY[d.kind])}
                        {d.acceptedBy ? (
                          <>
                            {" · "}
                            <span className="text-bz-ink-2">{d.acceptedBy}</span>
                          </>
                        ) : null}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {d.files.map((f) =>
                          f.scanning ? (
                            <span key={f.id} className={cn(FILE_TAG, "opacity-70")} title={t("c2.docs.scanning")}>
                              <FileTagBody name={f.name} meta={t("c2.docs.scanning")} image={f.image} />
                            </span>
                          ) : (
                            <a key={f.id} href={fileHref(f.id)} target="_blank" rel="noopener" className={cn(FILE_TAG, "hover:border-bz-border-strong")}>
                              <FileTagBody name={f.name} meta={f.meta} image={f.image} />
                            </a>
                          ),
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {firstFile ? (
                        d.state === "accepted" ? (
                          <Button asChild variant="ghost" className="text-[13px]">
                            <a href={fileHref(firstFile.id)} target="_blank" rel="noopener" aria-label={`${t("c2.docs.open")} ${name}`}>
                              <Eye strokeWidth={1.6} />
                              {t("c2.docs.open")}
                            </a>
                          </Button>
                        ) : (
                          <Button asChild variant={d.id === firstToReview ? "default" : "outline"} className="text-[13px]">
                            <a href={fileHref(firstFile.id)} target="_blank" rel="noopener" aria-label={`${t("c2.docs.review")} ${name}`}>
                              {t("c2.docs.review")}
                            </a>
                          </Button>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 border-t border-bz-border bg-bz-surface-2 px-5 py-[11px] text-[12px] text-bz-muted">
              <Glyph name="lock" size={14} />
              {t("c2.docs.private")}
            </div>
          </section>

          <Card
            title={t("card.applicant")}
            aside={file.can.act ? <EditApplicantDialog target={target} values={applicantValues(file)} /> : null}
          >
            <dl className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
              {(
                [
                  [t("field.fullName"), file.fullName],
                  [t("field.dateOfBirth"), file.dobAge],
                  [t("c2.applicant.residency"), t(RESIDENCY_KEY[file.residency])],
                  [t("c2.applicant.employment"), t(EMPLOYMENT_KEY[file.employment])],
                  [t("field.mobile"), file.mobileDisplay],
                  [t("field.email"), file.email],
                  [t("c2.applicant.submitted"), file.submittedDisplay],
                  [t("field.startedFrom"), file.startedFrom],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="min-w-0">
                  <dt className="text-[11.5px] text-bz-muted">{label}</dt>
                  <dd className="mt-[3px] truncate text-[13px]" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <OwnerCard file={file} target={target} />
          <Card title={t("c2.consent.title")}>
            {file.consent ? (
              <div className="flex gap-2.5">
                <span aria-hidden className="grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-[oklch(0.55_0.12_145)] text-bz-bg">
                  <Check size={12} strokeWidth={2.8} />
                </span>
                <div className="text-[12.5px] leading-[1.5]">
                  <div className="font-medium">{t("c2.consent.name")}</div>
                  <div className="mt-0.5 text-bz-muted">{file.consent.given}</div>
                  {file.consent.pendingCompliance ? (
                    <div className="mt-2">
                      <Pill tone="warn" small>
                        {t("c2.consent.pending", { version: file.consent.wordingVersion })}
                      </Pill>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-bz-muted">—</p>
            )}
          </Card>
          <ActivityCard items={file.activity} />
        </div>
      </div>
    </CmsShell>
  );
}

function applicantValues(file: RequestFile) {
  return {
    fullName: file.fullName,
    dateOfBirth: file.dateOfBirth,
    mobile: file.mobile,
    email: file.email,
    residency: file.residency,
    employmentLabel: t(EMPLOYMENT_KEY[file.employment]),
  };
}

function OwnerCard({ file, target }: { file: RequestFile; target: Target }) {
  return (
    <Card
      title={t("c2.owner.title")}
      aside={file.can.reassign ? <ReassignDialog target={target} team={file.team} ownerId={file.owner?.id ?? null} /> : null}
    >
      <div className="flex items-center justify-between gap-3">
        <OwnerAvatar owner={file.owner} size={34} named role={roleLabel(file.owner?.role ?? null)} />
        {file.can.claim ? <ClaimButton target={target} /> : null}
      </div>
      <div className="mt-3.5">
        <ContactButtons mobile={file.mobile} email={file.email} />
      </div>
    </Card>
  );
}

// ── C6 ───────────────────────────────────────────────────────────

const CONSULT_STAGES = ["status.new", "status.contacted", "status.consultationBooked", "status.completed"];
const CONSULT_AT: Partial<Record<RequestFile["status"], number>> = { new: 0, contacted: 1, consultation_booked: 2, completed: 3 };

type BookingData = { days: BookingDay[]; slots: Record<string, Record<string, Slot[]>> };

/** The next four working days, and each adviser's free slots on them: working hours minus bookings (C6). */
async function bookingData(
  db: Awaited<ReturnType<typeof requireMortgageRole>>["supabase"],
  file: RequestFile,
  loaded: LoadedSettings,
  now: Date,
): Promise<BookingData> {
  if (file.status !== "new" && file.status !== "contacted") return { days: [], slots: {} };
  const holidays = new Set(loaded.holidays.map((h) => h.day));
  const days = nextWorkingDays({ from: now, count: 4, setting: loaded.settings.working_hours, holidays });
  const calendar = await loadAdviserCalendar(db, file.team.map((m) => m.id), now);
  const slots: BookingData["slots"] = {};
  for (const member of file.team) {
    slots[member.id] = {};
    for (const day of days) {
      const [y, m, d] = day.split("-").map(Number) as [number, number, number];
      const weekday = dubaiWeekday(dubaiDayStart(dubaiInstant(y, m, d, 12).getTime()));
      slots[member.id]![day] = slotsForDay({
        day,
        windows:
          windowsFromAdviserHours(calendar.hours[member.id] ?? [], weekday) ?? windowsFromSetting(loaded.settings.working_hours, weekday),
        holidays,
        bookings: calendar.bookings[member.id] ?? [],
        gridMinutes: loaded.settings.slot_grid_minutes,
        durationMinutes: loaded.settings.consultation_minutes,
        now,
      });
    }
  }
  return {
    days: days.map((key) => {
      const [y, m, d] = key.split("-").map(Number) as [number, number, number];
      return { key, label: formatWeekdayDate(dubaiInstant(y, m, d, 12)) };
    }),
    slots,
  };
}

function Consultancy({
  file,
  target,
  breadcrumbs,
  booking,
  now,
}: {
  file: RequestFile;
  target: Target;
  breadcrumbs: React.ReactNode;
  booking: BookingData;
  now: Date;
}) {
  const open = file.status === "new" || file.status === "contacted";
  const firstName = file.firstName;
  const c = file.consultation;
  const formatLabel = (f: "phone" | "video" | "office") => t(`format.${f}`);

  return (
    <CmsShell
      title={file.fullName}
      breadcrumbs={breadcrumbs}
      secondary={
        file.status !== "completed" ? <InviteButton target={target} canAct={file.can.act} variant="outline" /> : null
      }
      primary={open ? <BookScrollButton /> : null}
    >
      <FileRefresher />
      <FileHeader
        chips={[
          { label: t("service.consultancy"), tone: "accent" },
          { label: file.residencyWithLtv },
          { label: t(EMPLOYMENT_KEY[file.employment]) },
        ]}
        right={
          <span className="text-[12.5px] text-bz-ink-2">
            {file.status === "completed" && file.closedAt ? t("c6.completed", { when: formatWhen(file.closedAt, now) }) : file.receivedLine}
          </span>
        }
      />
      <StageRail stages={CONSULT_STAGES.map((k) => t(k))} at={CONSULT_AT[file.status] ?? 0} />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card
            title={t("c6.log.title")}
            aside={
              <span className="flex items-center gap-2 text-[12px] text-bz-muted">
                {file.owner ? t("c6.log.owner", { name: file.owner.name }) : t("owner.unassigned")}
                {file.can.claim ? <ClaimButton target={target} size="link" /> : null}
                {file.can.reassign ? <ReassignDialog target={target} team={file.team} ownerId={file.owner?.id ?? null} /> : null}
              </span>
            }
          >
            <ActivityList items={file.activity} />
            {file.status !== "completed" ? <ContactAttemptBar target={target} canAct={file.can.act} mobile={file.mobile} /> : null}
          </Card>

          {open ? (
            <Card id="book" title={t("c6.book.title")}>
              <BookingCard
                target={target}
                team={file.team}
                ownerId={file.owner?.id ?? null}
                firstName={firstName}
                days={booking.days}
                slots={booking.slots}
                canAct={file.can.act}
                needsContact={file.status === "new"}
              />
            </Card>
          ) : c ? (
            <Card id="book" title={t("c6.booked.title")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1">
                  <div className="text-[13.5px] font-medium">
                    {t("c6.booked.when", { when: c.when, format: formatLabel(c.format), adviser: c.adviser?.name ?? "" })}
                  </div>
                  <div className="mt-1 text-[12px] text-bz-muted">{c.invited ? t("c6.booked.invited") : t("c6.booked.notInvited")}</div>
                </div>
                {file.status === "consultation_booked" ? <HeldButton target={target} canAct={file.can.act} /> : <StatusPill status={file.status} />}
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card title={t("card.applicant")} aside={file.can.act ? <EditApplicantDialog target={target} values={applicantValues(file)} /> : null}>
            <KeyValueList
              rows={[
                [t("field.fullName"), file.fullName],
                [t("field.dateOfBirth"), file.dobAge],
                [t("c6.applicant.residency"), t(RESIDENCY_KEY[file.residency])],
                [t("c6.applicant.employment"), t(EMPLOYMENT_KEY[file.employment])],
                [t("field.mobile"), file.mobileDisplay],
                [t("field.email"), file.email],
                [t("field.startedFrom"), file.startedFrom],
              ]}
            />
          </Card>
          <Card title={t("c6.docs.title")}>
            <p className="text-[12.5px] leading-[1.5] text-bz-ink-2">{t("c6.docs.body")}</p>
          </Card>
          {file.status !== "completed" ? (
            <div className="rounded-[10px] bg-bz-accent-soft p-5">
              <h2 className="text-[13.5px] font-medium">{t("c6.ready.title")}</h2>
              <p className="mt-1.5 text-[12.5px] leading-[1.55] text-bz-ink-2">
                {t("c6.ready.body", { firstName, employment: t(EMPLOYMENT_KEY[file.employment]) })}
              </p>
              {file.invite ? <p className="mt-2 text-[12px] text-bz-ink-2">{t("c6.invite.sent", { when: file.invite.expires })}</p> : null}
              <div className="mt-3.5">
                <InviteButton target={target} canAct={file.can.act} variant="default" resend={!!file.invite} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </CmsShell>
  );
}
