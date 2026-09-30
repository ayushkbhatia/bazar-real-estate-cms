"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Glyph } from "@/components/mortgage/glyphs";
import { Pill, RadioMark, type Tone } from "./primitives";

/**
 * W1's service cards and W2's tiles: radio groups built on real
 * `<input type="radio">`s, so arrow keys move the choice and the whole card
 * is the target (00-foundations §11). The input is visually hidden; the ring
 * goes on the card.
 */

export function ServiceCard({
  name,
  value,
  checked,
  onSelect,
  title,
  description,
  chip,
  chipTone,
  badge,
  needsLabel,
  needs,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  title: string;
  description: string;
  chip: string;
  chipTone: Tone;
  badge?: string;
  needsLabel: string;
  needs: string;
}) {
  const id = useId();
  return (
    <label
      className={cn(
        "relative flex cursor-pointer flex-col rounded-2xl border bg-bz-surface p-7 transition-[border-color,box-shadow] md:min-h-[318px]",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-bz-ink",
        checked
          ? "border-bz-ink shadow-[0_0_0_1px_var(--bz-ink),0_14px_36px_rgba(0,0,0,0.07)]"
          : "border-bz-border hover:border-bz-border-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc ${id}-needs`}
      />
      <div className="flex min-h-[26px] items-center justify-between">
        <RadioMark on={checked} size={22} />
        {badge ? (
          <Pill tone="ink">
            <Glyph name="clock" size={13} />
            {badge}
          </Pill>
        ) : null}
      </div>
      <span id={`${id}-title`} className="serif mt-[30px] text-[32px] leading-[1.04] tracking-[-0.02em] md:text-[36px]">
        {title}
      </span>
      <span id={`${id}-desc`} className="mt-2.5 text-[15px] leading-[1.55] text-bz-ink-2">
        {description}
        {badge ? <span className="sr-only"> {badge}.</span> : null}
        <span className="sr-only"> {chip}.</span>
      </span>
      <span className="mt-[18px]" aria-hidden>
        <Pill tone={chipTone}>{chip}</Pill>
      </span>
      <span className="mt-auto block pt-[22px]">
        <span className="block border-t border-bz-border pt-[18px]">
          <span className="eyebrow block text-[10.5px] text-bz-muted">{needsLabel}</span>
          <span id={`${id}-needs`} className="mt-1.5 block text-[13.5px] leading-[1.5] text-bz-ink-2">
            {needs}
          </span>
        </span>
      </span>
    </label>
  );
}

export function ChoiceTile({
  name,
  value,
  checked,
  onSelect,
  title,
  sub,
  invalid,
  describedBy,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: (value: string) => void;
  title: string;
  sub: ReactNode;
  invalid?: boolean;
  describedBy?: string;
}) {
  const id = useId();
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3.5 rounded-xl border bg-bz-surface px-[18px] py-[15px] transition-[border-color,box-shadow]",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-bz-ink",
        checked
          ? "border-bz-ink shadow-[0_0_0_0.5px_var(--bz-ink)]"
          : invalid
            ? "border-[var(--mrq-danger-row-border)]"
            : "border-bz-border hover:border-bz-border-strong",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="sr-only"
        aria-labelledby={`${id}-title`}
        aria-describedby={[`${id}-sub`, describedBy].filter(Boolean).join(" ")}
      />
      <RadioMark on={checked} />
      <span>
        <span id={`${id}-title`} className="block text-[15px] font-medium">
          {title}
        </span>
        <span id={`${id}-sub`} className="mt-0.5 block text-[12.5px] text-bz-muted">
          {sub}
        </span>
      </span>
    </label>
  );
}
