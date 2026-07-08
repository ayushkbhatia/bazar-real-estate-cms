import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fluid } from "./fluid";

export type AreaRow = {
  num: number;
  name: string;
  tagline: string;
  about: string;
  /** Count of live listings, if resolved. */
  count?: number;
  href?: string;
};

type Props = {
  areas: AreaRow[];
  ctaLabel?: string;
};

/**
 * Numbered editorial area rows (num · name · tagline · about · CTA). Collapses
 * to a stacked card on mobile (the handoff's `AreaList`).
 */
export function AreaList({ areas, ctaLabel = "View properties" }: Props) {
  return (
    <div className="border-t border-bz-border">
      {areas.map((a) => (
        <div
          key={a.name}
          className="grid grid-cols-1 md:grid-cols-[72px_1.1fr_1.3fr_auto] gap-4 md:gap-10 py-8 md:py-10 border-b border-bz-border md:items-center"
        >
          <div
            className="serif text-bz-muted-2"
            style={{ fontSize: fluid(44), letterSpacing: "-0.02em" }}
          >
            {String(a.num).padStart(2, "0")}
          </div>
          <div>
            <div
              className="serif"
              style={{ fontSize: fluid(30), letterSpacing: "-0.02em" }}
            >
              {a.name}
            </div>
            <p className="text-[14px] text-bz-ink-2 mt-2 leading-[1.5]">
              {a.tagline}
            </p>
            {typeof a.count === "number" ? (
              <p className="mono text-[12px] text-bz-muted mt-2">
                {a.count} {a.count === 1 ? "listing" : "listings"}
              </p>
            ) : null}
          </div>
          <p className="text-[13.5px] text-bz-muted leading-[1.6]">{a.about}</p>
          <div>
            <Button asChild variant="outline">
              <Link href={a.href ?? "/communities"}>
                {ctaLabel}
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
