"use client";

import { useQueryState } from "nuqs";
import { parseAsStringEnum } from "nuqs";
import { cn } from "@/lib/utils";

const SECTIONS = ["kyc", "deal", "other"] as const;
type Section = (typeof SECTIONS)[number];

const LABELS: Record<Section, { label: string; subtitle: string }> = {
  kyc: { label: "Identity & KYC", subtitle: "Passport · Emirates ID · proof of address" },
  deal: { label: "Offer & deal", subtitle: "MoU · NOC · title deed · transfer" },
  other: { label: "Other", subtitle: "Bank pre-approval · references · misc" },
};

/**
 * Sprint 6 (backfilled): document section tabs on /account/documents.
 * URL-state driven so direct links land on the right tab.
 */
export function DocumentSectionTabs({
  counts,
}: {
  counts: Record<Section, number>;
}) {
  const [tab, setTab] = useQueryState(
    "section",
    parseAsStringEnum<Section>([...SECTIONS]).withDefault("kyc"),
  );

  return (
    <nav
      role="tablist"
      aria-label="Document section"
      className="border-b border-bz-border flex gap-5"
    >
      {SECTIONS.map((s) => {
        const active = tab === s;
        const meta = LABELS[s];
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(s === "kyc" ? null : s)}
            className={cn(
              "py-3 inline-flex flex-col items-start gap-0.5 border-b-2 -mb-px transition-colors text-left",
              active
                ? "border-bz-ink text-bz-ink"
                : "border-transparent text-bz-muted hover:text-bz-ink-2",
            )}
          >
            <span className="inline-flex items-center gap-2 text-[13.5px]">
              {meta.label}
              <span
                className={cn(
                  "mono text-[11px] px-1.5 rounded",
                  active
                    ? "bg-bz-ink text-bz-bg"
                    : "bg-bz-surface-2 text-bz-muted",
                )}
              >
                {counts[s]}
              </span>
            </span>
            <span className="text-[11.5px] text-bz-muted">{meta.subtitle}</span>
          </button>
        );
      })}
    </nav>
  );
}
