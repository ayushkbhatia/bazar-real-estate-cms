import { Eyebrow } from "@/components/brand/eyebrow";

type Lead = {
  source: string;
  budgetMin: number | null;
  budgetMax: number | null;
  timeline: string | null;
  preApproved: boolean;
  residencyStatus?: string | null;
  firstContactAt: string;
};

/**
 * Sprint 7e (backfilled): "About this lead" structured block in the
 * context pane. Reads from the enquiry row directly — the existing
 * `getEnquiryById` query already returns these fields.
 */
export function AboutLeadBlock({ lead }: { lead: Lead }) {
  const budgetLabel =
    lead.budgetMin && lead.budgetMax
      ? `AED ${(lead.budgetMin / 1_000_000).toFixed(1)}M – ${(lead.budgetMax / 1_000_000).toFixed(1)}M`
      : lead.budgetMin
        ? `From AED ${(lead.budgetMin / 1_000_000).toFixed(1)}M`
        : lead.budgetMax
          ? `Up to AED ${(lead.budgetMax / 1_000_000).toFixed(1)}M`
          : "—";

  const firstContact = new Date(lead.firstContactAt).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );

  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <Eyebrow>About this lead</Eyebrow>
      <dl className="mt-3 grid grid-cols-[100px_1fr] gap-y-2 text-[12.5px]">
        <Row label="Source" value={prettify(lead.source)} />
        <Row label="Budget" value={budgetLabel} />
        <Row label="Timeline" value={lead.timeline ? prettify(lead.timeline) : "—"} />
        <Row
          label="Pre-approved"
          value={lead.preApproved ? "Yes" : "Not on file"}
          highlight={lead.preApproved ? "accent" : undefined}
        />
        <Row
          label="Residency"
          value={lead.residencyStatus ? prettify(lead.residencyStatus) : "—"}
        />
        <Row label="First contact" value={firstContact} />
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "accent" | "warn";
}) {
  return (
    <>
      <dt className="text-bz-muted">{label}</dt>
      <dd
        className={
          highlight === "accent"
            ? "text-bz-accent font-medium"
            : highlight === "warn"
              ? "text-bz-warning font-medium"
              : "text-bz-ink"
        }
      >
        {value}
      </dd>
    </>
  );
}

function prettify(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}
