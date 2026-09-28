"use client";

import { useEffect, useRef } from "react";
import { Glyph } from "./glyphs";

/**
 * A submit that didn't go through (W3 "Errors": an inline message above the
 * actions, with the CTA re-enabled; the copy is FE-1). An `alert`, focused,
 * so it is heard as well as seen.
 */
export function SubmitAlert({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [message]);
  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="mt-6 flex gap-2.5 rounded-xl border border-[var(--mrq-danger-row-border)] bg-[var(--mrq-danger-row-bg)] px-4 py-3 text-[13.5px] leading-[1.5] text-[var(--mrq-danger-fg)] outline-none"
    >
      <Glyph name="alert" size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
