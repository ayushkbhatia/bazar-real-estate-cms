import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Button } from "@/components/ui/button";
import { firstNameOf, formatActivityTime, formatDayMonth, formatLongDate, formatWhen } from "@/lib/mortgage-requests/cms-format";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { declineReasonLabel } from "@/lib/mortgage-requests/decline";
import { formatTime } from "@/lib/mortgage-requests/format";
import { daysUntil, formatAed, formatLongDateWords, formatRate } from "@/lib/mortgage-requests/pre-approval";
import { getMortgageRole, requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";
import { EMPLOYMENT_KEY, RESIDENCY_KEY } from "@/lib/mortgage-requests/server/cms-queries";
import { dubaiToday, getDecision, type DecisionData, type SubmissionView } from "@/lib/mortgage-requests/server/decision";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { formatDuration } from "@/lib/mortgage-requests/sla";
import { cn } from "@/lib/utils";
import { DecisionView, type BankRowView, type DecidedView } from "../../_components/decision-view";
import { ActivityCard, FileRefresher, type Target } from "../../_components/file-actions";
import { FileHeader, PromiseClock, StageRail, StatusPill } from "../../_components/ui";

export const dynamic = "force-dynamic";

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  if (!(await getMortgageRole())) return {};
  const { reference } = await params;
  return { title: `${decodeURIComponent(reference)} · ${t("c5.decision.title")}` };
}

const STAGES = ["status.new", "status.inReview", "status.withBanks", "status.preApproved"];

/**
 * C5 · Decision (docs/mortgage/cms/C5-decision): the banks' responses side by
 * side, the offer to lead with, and the pre-approval — or the decline — that
 * goes to the applicant. Only for a file with the banks, or decided through
 * them; anything else is C2's.
 */
export default async function MortgageDecisionPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const { user, role, supabase } = await requireMortgageRole();
  const loaded = await loadMortgageSettings(supabase);
  const now = new Date();
  const data = await getDecision(supabase, decodeURIComponent(reference), {
    now,
    me: { id: user.id, role },
    policy: loaded.policy,
    settings: loaded.settings,
  });
  if (!data) notFound();
  const { file } = data;
  const fileHref = `/admin/mortgages/${encodeURIComponent(file.reference)}`;
  if (file.status !== "with_banks" && file.decision?.from !== "with_banks") redirect(fileHref);

  const target: Target = { requestId: file.id, reference: file.reference, updatedAt: file.updatedAt };
  const today = dubaiToday(now);
  const rows = data.submissions.map((s) => bankRow(s, now, today));
  const consentOk = !!data.tiles.consentGivenAt && !!file.consent && !file.consent.withdrawn;
  const decided: DecidedView | null = file.decision
    ? {
        kind: file.decision.kind,
        leadId: data.leadSubmissionId,
        message: file.decision.message,
        reason: file.decision.reason ? declineReasonLabel(file.decision.reason) : null,
        line: file.decision.decidedBy
          ? t("c2.decision.by", { name: file.decision.decidedBy.name, when: formatWhen(file.decision.decidedAt, now) })
          : t("c5.decided", { when: formatWhen(file.decision.decidedAt, now) }),
      }
    : null;
  const stages =
    file.status === "declined" ? [...STAGES.slice(0, 3).map((k) => t(k)), t("status.declined")] : STAGES.map((k) => t(k));

  return (
    <CmsShell
      title={file.fullName}
      breadcrumbs={
        <>
          {cmsT("nav.group")} › <Link href="/admin/mortgages">{cmsT("nav.mortgages")}</Link> ›{" "}
          <Link href={fileHref} className="mono">
            {file.reference}
          </Link>{" "}
          › {t("c5.decision.title")}
        </>
      }
      secondary={
        <Button asChild variant="ghost" size="sm" className="text-[13px]">
          <Link href={fileHref}>
            <ArrowLeft strokeWidth={1.6} />
            {t("common.backToFile")}
          </Link>
        </Button>
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
            {file.decision ? <StatusPill status={file.status} /> : null}
            {file.sla ? <PromiseClock sla={file.sla} width={300} showDue /> : null}
          </span>
        }
      />
      <StageRail stages={stages} at={file.status === "with_banks" ? 2 : 3} />

      <DecisionView
        target={target}
        firstName={file.firstName}
        myFirstName={firstNameOf(file.team.find((m) => m.id === file.me.id)?.name ?? "")}
        rows={rows}
        basis={basisLine(data)}
        canAct={file.can.act && file.status === "with_banks"}
        consentOk={consentOk}
        elapsed={file.sla?.elapsedSeconds != null ? formatDuration(file.sla.elapsedSeconds) : null}
        decided={decided}
        tiles={<Tiles data={data} now={now} consentOk={consentOk} />}
        activity={<ActivityCard items={file.activity} />}
      />
    </CmsShell>
  );
}

/** One bank's row as C5 prints it: the words and figures, formatted here in Dubai time. */
function bankRow(s: SubmissionView, now: Date, today: string): BankRowView {
  const o = s.offer;
  const fixed = o?.rateType === "fixed" && o.fixedYears;
  const days = o ? daysUntil(o.validUntil, today) : 0;
  return {
    id: s.id,
    bank: s.bank,
    status: s.status,
    pill:
      s.status === "pre_approved"
        ? t("c5.bank.preApproved", { time: formatActivityTime(s.respondedAt ?? s.sentAt, now) })
        : s.status === "declined"
          ? t("c5.bank.declined", { time: formatActivityTime(s.respondedAt ?? s.sentAt, now) })
          : s.status === "withdrawn"
            ? t("c5.bank.withdrawn")
            : t("c5.bank.awaiting", { time: formatActivityTime(s.sentAt, now) }),
    reminder: s.status === "sent" && s.reminderSentAt ? t("c5.bank.reminderSent", { time: formatActivityTime(s.reminderSentAt, now) }) : null,
    offer: o
      ? {
          amountAed: o.amountAed,
          ratePct: o.ratePct,
          rateType: o.rateType,
          fixedYears: o.fixedYears,
          validUntil: o.validUntil,
          amount: formatAed(o.amountAed),
          rate: fixed
            ? t("c5.bank.rateValue", { rate: formatRate(o.ratePct), years: o.fixedYears! })
            : t("c5.bank.rateVariable", { rate: formatRate(o.ratePct) }),
          monthly: formatAed(o.monthlyAed),
          leadRate: fixed
            ? t("c5.lead.rateValue", { rate: formatRate(o.ratePct), years: o.fixedYears! })
            : t("c5.lead.rateVariableValue", { rate: formatRate(o.ratePct) }),
          valid: t("c5.lead.validValue", { date: shortDate(o.validUntil), days: Math.max(0, days) }),
          validWords: formatLongDateWords(o.validUntil),
          expired: o.expired,
          expiredOn: shortDate(o.validUntil),
        }
      : null,
    letter: s.letter ? { id: s.letter.id, name: s.letter.name } : null,
    notes: s.notes,
  };
}

/** "21 Nov 2026" (the design's Valid until). */
function shortDate(isoDate: string): string {
  return formatLongDate(isoDate).replace(/^0/, "");
}

/** The footer line under the banks: what the offers were priced on. */
function basisLine(data: DecisionData): string {
  const residency = t(RESIDENCY_KEY[data.file.residency]);
  if (data.basis.kind === "salary") {
    return t("c5.banks.basis", { salary: formatAed(data.basis.salaryAed), ltv: data.ltvPct, residency });
  }
  if (data.basis.kind === "business") return t("c5.banks.basisBusiness", { ltv: data.ltvPct, residency });
  return t("c5.banks.basisNoSalary", { ltv: data.ltvPct, residency });
}

/** The three facts a pre-approval rests on (C5's status tiles); one that no longer holds turns red. */
function Tiles({ data, now, consentOk }: { data: DecisionData; now: Date; consentOk: boolean }) {
  const { tiles } = data;
  const last = tiles.lastAccepted;
  const items: { ok: boolean; title: string; sub: string | null }[] = [
    {
      ok: tiles.total > 0 && tiles.accepted === tiles.total,
      title: t("c5.tile.docs.title", { accepted: tiles.accepted, total: tiles.total }),
      sub: last ? t("c5.tile.docs.sub", { name: firstNameOf(last.name), time: formatActivityTime(last.at, now) }) : null,
    },
    consentOk
      ? {
          ok: true,
          title: t("c5.tile.consent.title"),
          sub: t("c5.tile.consent.sub", { givenAt: `${formatDayMonth(tiles.consentGivenAt!)}, ${formatTime(tiles.consentGivenAt!)}` }),
        }
      : { ok: false, title: t("c5.tile.consentMissing.title"), sub: t("c5.tile.consentMissing.sub") },
    {
      ok: tiles.sentCount > 0,
      title: t("c5.tile.sent.title", { count: tiles.sentCount }),
      sub: tiles.sentAt ? t("c5.tile.sent.sub", { time: formatActivityTime(tiles.sentAt, now) }) : null,
    },
  ];
  return (
    <ul className="grid gap-2.5 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.title} className="flex gap-2.5 rounded-[10px] border border-bz-border bg-bz-surface px-3.5 py-3">
          <span
            aria-hidden
            className={cn(
              "grid size-[22px] shrink-0 place-items-center rounded-full text-white",
              item.ok ? "bg-[oklch(0.58_0.12_145)]" : "bg-[oklch(0.55_0.18_28)]",
            )}
          >
            {item.ok ? <Check size={11} strokeWidth={3} /> : <AlertTriangle size={11} strokeWidth={2.6} />}
          </span>
          <div className="min-w-0">
            <div className={cn("text-[12.5px] font-medium", !item.ok && "text-[oklch(0.45_0.13_28)]")}>{item.title}</div>
            {item.sub ? <div className="mt-px text-[11.5px] text-bz-muted">{item.sub}</div> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
