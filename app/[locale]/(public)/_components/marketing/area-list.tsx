import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/link";
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
 *
 * Two things about the phone layout are deliberate:
 *
 *  - **The ordinal sits beside the name, not above it.** It is one grid cell in
 *    both layouts; below `md` the grid is `auto 1fr` so the number takes the
 *    width of "01" and the name block takes the rest. On its own line it cost a
 *    33px band per row for two characters, and eight of those is a screenful.
 *  - **The row breathes less.** `py-8` → `py-6`, and the gaps come down with
 *    it. Nothing is hidden: the tagline, the count and the second paragraph all
 *    still render, because they are what the section is for.
 *
 * Everything from `md` up is exactly what it was.
 */
export async function AreaList({ areas, ctaLabel }: Props) {
  const t = await getTranslations("pages.offPlan");
  const cta = ctaLabel ?? t("viewProperties");
  return (
    <div className="border-t border-bz-border">
      {areas.map((a) => (
        <div
          key={a.name}
          // The ordinal's track is 64px on a phone, not `auto`. `auto` sizes it
          // to the two digits inside — 15-19px — and the mobile geometry gate
          // blocks any grid track under 60px, because a column that narrow is
          // where content gets clipped by an ancestor without ever showing up
          // as horizontal overflow.
          className="grid grid-cols-[64px_1fr] md:grid-cols-[72px_1.1fr_1.3fr_auto] gap-x-3 gap-y-3 md:gap-4 md:gap-x-10 py-6 md:py-10 border-b border-bz-border md:items-center"
        >
          <div
            className="serif text-bz-muted-2 leading-none md:leading-normal"
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
            <p className="text-[14px] text-bz-ink-2 mt-1.5 md:mt-2 leading-[1.5]">
              {a.tagline}
            </p>
            {typeof a.count === "number" ? (
              <p className="mono text-[12px] text-bz-muted mt-1.5 md:mt-2">
                {t("listings", { count: a.count })}
              </p>
            ) : null}
          </div>
          {/* Full-width under the pair above on a phone; its own track from
              `md`, where the row is four columns again. */}
          <p className="col-span-2 md:col-span-1 text-[13.5px] text-bz-muted leading-[1.6]">
            {a.about}
          </p>
          <div className="col-span-2 md:col-span-1">
            <Button asChild variant="outline">
              <Link href={a.href ?? "/areas"}>
                {cta}
                <ArrowRight size={15} strokeWidth={1.7} />
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
