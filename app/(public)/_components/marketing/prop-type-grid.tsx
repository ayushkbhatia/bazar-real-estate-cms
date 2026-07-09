import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

export type PropType = {
  name: string;
  desc: string;
  cta?: string;
  img?: string;
  href?: string;
};

type Props = {
  items: PropType[];
  /** Desktop column count (3 or 5 in the handoff). */
  cols?: 3 | 4 | 5;
  /** Media aspect ratio, e.g. "4/3" or "3/4". */
  aspect?: string;
};

const colClass: Record<NonNullable<Props["cols"]>, string> = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-5",
};

/**
 * Property-type cards (image + name + description + CTA). Responsive grid
 * (the handoff's `PropTypeGrid`).
 */
export function PropTypeGrid({ items, cols = 3, aspect = "4/3" }: Props) {
  return (
    <div className={cn("grid grid-cols-1 gap-5 md:gap-6", colClass[cols])}>
      {items.map((p) => {
        const body = (
          <article className="flex flex-col h-full rounded-lg border border-bz-border bg-bz-surface overflow-hidden">
            <div className="relative w-full" style={{ aspectRatio: aspect }}>
              <PlaceholderImage
                label={p.img ?? p.name.toLowerCase()}
                className="absolute inset-0 h-full w-full"
              />
            </div>
            <div className="p-5 flex flex-col flex-1">
              <div
                className="serif text-[20px] md:text-[24px]"
                style={{ letterSpacing: "-0.01em" }}
              >
                {p.name}
              </div>
              <p className="text-[13px] text-bz-ink-2 leading-[1.5] mt-2 flex-1">
                {p.desc}
              </p>
              {p.cta ? (
                <div className="flex items-center gap-2 mt-4 text-[13px] font-medium text-bz-accent">
                  {p.cta}
                  <ArrowRight size={14} strokeWidth={1.8} />
                </div>
              ) : null}
            </div>
          </article>
        );
        return p.href ? (
          <Link key={p.name} href={p.href} className="group block">
            {body}
          </Link>
        ) : (
          <div key={p.name}>{body}</div>
        );
      })}
    </div>
  );
}
