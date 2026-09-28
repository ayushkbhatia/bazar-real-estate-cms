import type { ReactNode } from "react";
import Link from "@/components/i18n/link";
import { cn } from "@/lib/utils";

/**
 * What the applicant has told us so far, shown back (00-foundations §5:
 * SelectionSummary, KeyValueList; W3's DetailsSummary). Rendered inside
 * `ph-no-capture` wherever it holds personal data, so PostHog's autocapture
 * and any session recording skip it.
 */

export function SelectionSummary({
  label,
  chips,
  action,
}: {
  label: string;
  /** The first chip is the service, drawn in ink. */
  chips: readonly string[];
  action: { label: string; href: string };
}) {
  return (
    <div className="mb-9 flex flex-wrap items-center gap-2 rounded-xl border border-bz-border bg-bz-surface px-4 py-2.5">
      <span className="eyebrow me-2 text-bz-muted">{label}</span>
      {chips.map((chip, i) => (
        <span
          key={chip}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-3 text-[12.5px] font-medium",
            i === 0 ? "bg-bz-ink text-bz-bg" : "bg-bz-surface-2 text-bz-ink",
          )}
        >
          {chip}
        </span>
      ))}
      <div className="flex-1" />
      <Link href={action.href} className="text-[12.5px] font-medium text-bz-accent hover:underline">
        {action.label}
      </Link>
    </div>
  );
}

export function KeyValueList({ rows }: { rows: readonly [label: string, value: ReactNode][] }) {
  return (
    <dl>
      {rows.map(([label, value], i) => (
        <div
          key={label}
          className={cn("flex justify-between gap-4 py-2 text-[13px]", i > 0 && "border-t border-bz-border")}
        >
          <dt className="shrink-0 text-bz-muted">{label}</dt>
          <dd className="min-w-0 text-end break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailsSummary({
  title,
  edit,
  rows,
}: {
  title: string;
  edit: { label: string; href: string };
  rows: readonly [label: string, value: string][];
}) {
  return (
    <section className="ph-no-capture mt-4 rounded-[14px] border border-bz-border bg-bz-surface">
      <div className="flex items-center justify-between border-b border-bz-border px-[22px] py-3.5">
        <h2 className="text-[13.5px] font-medium">{title}</h2>
        <Link href={edit.href} className="text-[12.5px] font-medium text-bz-accent hover:underline">
          {edit.label}
        </Link>
      </div>
      <dl className="grid gap-x-8 gap-y-4 px-[22px] pt-[18px] pb-5 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[12px] text-bz-muted">{label}</dt>
            <dd className="mt-[3px] text-[14.5px] break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
