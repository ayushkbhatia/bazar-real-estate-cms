import { cn } from "@/lib/utils";

export type ValueCard = { name: string; desc: string };

type Props = {
  items: ValueCard[];
  /** Desktop column count. */
  cols?: 2 | 3 | 4;
  /** Ink-on-navy treatment, for the band that sits on a dark surface. */
  dark?: boolean;
};

const colClass: Record<NonNullable<Props["cols"]>, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * Text-only card grid — a title and a line of copy per card.
 *
 * Distinct from `PropTypeGrid`, which is the same idea with an image well on
 * top. These sections are a list of what a service covers, and giving each of
 * six or eight of them a stock photo would be noise the editor then has to
 * source; the ones that genuinely want art use PropTypeGrid instead.
 */
export function ServiceValueGrid({ items, cols = 4, dark }: Props) {
  return (
    <div className={cn("grid grid-cols-1 gap-px", colClass[cols])}>
      {items.map((item) => (
        <div
          key={item.name}
          className={cn(
            "border-t pt-5 pb-1 sm:pr-6",
            dark ? "border-white/25" : "border-bz-border",
          )}
        >
          <h3
            className={cn(
              "text-[15px] font-semibold",
              dark ? "text-white" : "text-bz-ink",
            )}
          >
            {item.name}
          </h3>
          <p
            className={cn(
              "text-[13.5px] leading-[1.6] mt-2",
              dark ? "text-white/70" : "text-bz-ink-2",
            )}
          >
            {item.desc}
          </p>
        </div>
      ))}
    </div>
  );
}
