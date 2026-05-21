import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { getValuationRequest } from "@/lib/queries/valuations";
import { ValuationReviewForm } from "./valuation-review-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_review: "In review",
  sent: "Sent",
  archived: "Archived",
};

function formatAedFull(n: string | number | null): string {
  if (n == null) return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return `AED ${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function describeUpgrades(arr: unknown): string {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  return arr.join(" · ");
}

export default async function ValuationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const row = await getValuationRequest(id);
  if (!row) notFound();

  // `row` is a wide Record<string, unknown> shape from a select-everything
  // query — re-narrow the bits the JSX reads.
  const fields = row as unknown as Record<string, unknown> & {
    area_name: string | null;
    advisor_display_name: string | null;
    status: "pending" | "in_review" | "sent" | "archived";
  };

  return (
    <CmsShell
      title={`Valuation · ${row.owner_name as string}`}
      breadcrumbs={
        <>
          <Link href="/admin/valuations" className="hover:text-bz-ink">
            Valuations
          </Link>{" "}
          / {STATUS_LABELS[fields.status] ?? fields.status}
        </>
      }
      secondary={
        <Link
          href="/admin/valuations"
          className="text-[13px] text-bz-muted hover:text-bz-ink inline-flex items-center gap-1.5"
        >
          <ChevronLeft size={14} />
          Back
        </Link>
      }
    >
      <div className="grid lg:grid-cols-[1fr_440px] gap-6">
        {/* Left — full submission */}
        <section className="border border-bz-border bg-bz-surface rounded-lg p-6">
          <h2
            className="serif text-[22px] mb-4"
            style={{ letterSpacing: "-0.01em" }}
          >
            Submission
          </h2>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-3 text-[13.5px]">
            <Field
              label="Owner"
              value={`${row.owner_name as string} · ${row.owner_email as string}${row.owner_phone ? ` · ${row.owner_phone}` : ""}`}
            />
            <Field
              label="Area"
              value={
                fields.area_name ?? "(not in our area list)"
              }
            />
            <Field
              label="Building"
              value={(row.building_name as string | null) ?? "—"}
            />
            <Field
              label="Unit"
              value={(row.unit_number as string | null) ?? "—"}
            />
            <Field
              label="Address"
              value={(row.address_line as string | null) ?? "—"}
            />
            <Field
              label="Type"
              value={row.property_type as string}
            />
            <Field
              label="Beds / baths"
              value={`${row.beds} / ${row.baths}`}
            />
            <Field
              label="Built-up area"
              value={
                row.built_up_ft2
                  ? `${(row.built_up_ft2 as number).toLocaleString()} ft²`
                  : "—"
              }
            />
            <Field
              label="Floor"
              value={
                row.floor == null ? "—" : `Floor ${row.floor}`
              }
            />
            <Field
              label="Condition"
              value={(row.condition as string | null) ?? "—"}
            />
            <Field
              label="Furnishing"
              value={(row.furnishing as string | null) ?? "—"}
            />
            <Field
              label="View"
              value={(row.view_description as string | null) ?? "—"}
            />
            <Field
              label="Tenancy"
              value={(row.tenancy as string | null) ?? "—"}
            />
            <Field
              label="Mortgage"
              value={(row.mortgage_state as string | null) ?? "—"}
            />
          </dl>

          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-widest text-bz-muted mb-1.5">
              Upgrades
            </div>
            <div className="text-[13px] text-bz-ink-2 leading-relaxed">
              {describeUpgrades(row.upgrades)}
            </div>
          </div>

          <div className="border-t border-bz-border my-6" />

          <h3
            className="serif text-[18px] mb-3"
            style={{ letterSpacing: "-0.01em" }}
          >
            Instant range (frozen at submission)
          </h3>
          <dl className="grid grid-cols-3 gap-3 text-[13.5px]">
            <Field
              label="Low"
              value={formatAedFull(row.estimate_low_aed as string | null)}
            />
            <Field
              label="Mid"
              value={formatAedFull(row.estimate_mid_aed as string | null)}
            />
            <Field
              label="High"
              value={formatAedFull(row.estimate_high_aed as string | null)}
            />
          </dl>
        </section>

        {/* Right — advisor work area */}
        <aside className="border border-bz-border bg-bz-surface rounded-lg p-6 lg:sticky lg:top-6">
          <ValuationReviewForm
            id={row.id as string}
            status={fields.status as "pending" | "in_review" | "sent" | "archived"}
            advisorDisplayName={fields.advisor_display_name}
            initialAdvisorEstimateAed={
              row.advisor_estimate_aed
                ? Number(row.advisor_estimate_aed)
                : null
            }
            initialAdvisorNotes={(row.advisor_notes as string | null) ?? ""}
            sentAt={(row.sent_at as string | null) ?? null}
          />
        </aside>
      </div>
    </CmsShell>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-bz-muted mb-0.5">
        {label}
      </dt>
      <dd className="text-bz-ink">{value}</dd>
    </div>
  );
}
