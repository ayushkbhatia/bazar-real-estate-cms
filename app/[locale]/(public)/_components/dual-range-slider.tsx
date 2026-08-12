"use client";

import { useRef, useState, useEffect, useCallback } from "react";

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
      <div className="relative h-6">
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
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bz-navy [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-bz-navy [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
        />
        <input
          type="range"
          aria-label="Maximum"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => handleHi(Number(e.target.value))}
          className="absolute inset-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bz-navy [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-bz-navy [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-0"
        />
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-bz-ink-2">
        <span>{format(lo)}</span>
        <span>{format(hi)}</span>
      </div>
    </div>
  );
}
