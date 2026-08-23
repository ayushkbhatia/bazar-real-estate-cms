"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/**
 * Coarse-pointer thumb geometry — added to both inputs.
 *
 * Both ranges are `pointer-events-none` with `pointer-events-auto` restored on
 * the thumb: the standard two-overlapping-inputs trick, without which the one
 * painted second would swallow every press meant for the first. The cost is
 * that the only tappable region is the thumb box itself, so growing the
 * wrapper buys nothing. Measured in Chromium by walking
 * `document.elementFromPoint` through the thumb's centre, once per axis:
 *
 *     16px thumb in a 24px wrapper (what shipped)     16 x 16
 *     24px thumb in a 44px wrapper                    24 x 24  ← wrapper inert
 *     24px content box inside a 44px border box       24 x 44  ← this
 *
 * So the block axis is bought with a 44px-tall thumb whose outer 10px top and
 * bottom is transparent border and whose fill is clipped to the content box:
 * the painted circle stays 24px, the hit box is 44px.
 *
 * The border is one arbitrary `border-block` shorthand rather than Tailwind's
 * `border-y-[10px]`, and that is not stylistic. Preflight zeroes borders on
 * `*`, `::before`, `::after`, `::backdrop` and `::file-selector-button` — never
 * on `::-webkit-slider-thumb`, which therefore keeps the initial
 * `border-style: none` and the initial `medium` border-width. Checked against
 * the compiled sheet, neither Tailwind spelling survives that:
 *
 *   · `border-y-[10px]` alone emits `border-block-style: var(--tw-border-style)`
 *     and leans on `@property --tw-border-style`'s `initial-value: solid`. The
 *     `@supports` fallback for engines without `@property` (iOS Safari below
 *     16.4 — squarely in this fix's audience) sets that variable on the same
 *     five preflight selectors and so misses the thumb, leaving style `none`
 *     and a border that measures zero.
 *   · adding `border-solid` fixes the style but sets all four sides, and with
 *     nothing zeroing the thumb's width the inline sides come back at the
 *     initial `medium`, measured at 3px in Chromium. Inside `box-border` that
 *     leaves an 18px content box in a 24px thumb, and the circle paints as an
 *     oval.
 *
 * The shorthand sets width, style and colour on the block axis only, in one
 * declaration, depending on no custom property to do it. It is also exactly
 * the CSS the measurement above was taken against.
 *
 * The inline axis deliberately stays 24px. The thumb BOX is what travels, so
 * its width is subtracted from the span the browser maps values across, while
 * the teal band beside it is positioned from raw percentages of the full
 * width. The two agree only while the painted circle and the box are the same
 * width; at 44px wide the band would overhang the max handle by ~10px on a
 * 300px control — visible in the default state, where `hi` starts at `max`.
 *
 * Firefox keeps a plain 24px thumb. `::-moz-range-thumb` was not measured
 * here, and shipping an unverified content-box trick to it would be a guess.
 */
const TOUCH_THUMB = [
  "pointer-coarse:[&::-webkit-slider-thumb]:box-border",
  "pointer-coarse:[&::-webkit-slider-thumb]:w-6",
  "pointer-coarse:[&::-webkit-slider-thumb]:h-11",
  "pointer-coarse:[&::-webkit-slider-thumb]:[border-block:10px_solid_transparent]",
  "pointer-coarse:[&::-webkit-slider-thumb]:bg-clip-content",
  // Explicit elliptical radii, because `rounded-full` paints a DRUM here.
  //
  // `rounded-full` is `calc(infinity * 1px)`. On the 24x44 border box the
  // spec's overlap scaling clamps every corner to 12px on both axes, and
  // `bg-clip-content` then paints against content-box radii — border-box
  // radius minus the border on that side. Horizontally 12-0=12, vertically
  // 12-10=2. The result is a 24x24 patch with flat sides and 2px of curve.
  //
  // 12px/22px survives the clamp untouched (24/(12+12)=1, 44/(22+22)=1) and
  // reduces to 12/12 on the content box — a true 24px circle.
  "pointer-coarse:[&::-webkit-slider-thumb]:rounded-[12px/22px]",
  "pointer-coarse:[&::-moz-range-thumb]:w-6",
  "pointer-coarse:[&::-moz-range-thumb]:h-6",
].join(" ");

/**
 * Sprint 4 (backfilled): dual-handle range slider for price + ft².
 * Pure-CSS + a couple of inputs — no extra deps. Emits `onChange` with
 * the current { min, max } and renders the filled middle band as the
 * user drags either handle.
 */
export function DualRangeSlider({
  min,
  max,
  step = 100_000,
  initial,
  format,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  initial: { min: number | null; max: number | null };
  format: (n: number) => string;
  onChange: (range: { min: number | null; max: number | null }) => void;
}) {
  const [lo, setLo] = useState<number>(initial.min ?? min);
  const [hi, setHi] = useState<number>(initial.max ?? max);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Debounce push of the latest values up so query-string updates don't
  // thrash on every drag tick.
  useEffect(() => {
    const t = setTimeout(() => {
      onChangeRef.current({
        min: lo === min ? null : lo,
        max: hi === max ? null : hi,
      });
    }, 200);
    return () => clearTimeout(t);
  }, [lo, hi, min, max]);

  const loPct = ((lo - min) / (max - min)) * 100;
  const hiPct = ((hi - min) / (max - min)) * 100;

  const handleLo = useCallback(
    (v: number) => setLo(Math.min(v, hi - step)),
    [hi, step],
  );
  const handleHi = useCallback(
    (v: number) => setHi(Math.max(v, lo + step)),
    [lo, step],
  );

  return (
    <div>
      {/*
        44px tall on a thumb, 24px on a mouse. The painted track is `h-1` and
        centred with `top-1/2 -translate-y-1/2`, so growing the wrapper moves
        nothing that is visible — it only gives the two `absolute inset-0`
        inputs the height the taller thumb needs to sit in.
      */}
      <div className="relative h-6 pointer-coarse:h-11">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-bz-surface-2" />
        {/*
          Logical inset, not left/right.

          Native range inputs already mirror themselves under dir="rtl" — a
          value of 25 sits 25% from the LEFT in LTR and 25% from the RIGHT in
          RTL, measured directly rather than assumed. So the thumbs were never
          the problem; this band was. Pinned to physical left/right it stayed
          put while the thumbs flipped, leaving the fill and the handles
          travelling in opposite directions on the home hero.

          Using the inline axis puts the band on the same axis the browser
          already uses for the thumbs, which is why this needs no direction
          flag and no JS: it is correct in both directions by construction.
        */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-bz-teal"
          style={{
            insetInlineStart: `${loPct}%`,
            insetInlineEnd: `${100 - hiPct}%`,
          }}
        />
        <input
          type="range"
          aria-label="Minimum"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => handleLo(Number(e.target.value))}
          className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bz-navy [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-bz-navy [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 ${TOUCH_THUMB}`}
        />
        <input
          type="range"
          aria-label="Maximum"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => handleHi(Number(e.target.value))}
          className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bz-navy [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-bz-navy [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0 ${TOUCH_THUMB}`}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-bz-ink-2">
        <span>{format(lo)}</span>
        <span>{format(hi)}</span>
      </div>
    </div>
  );
}
