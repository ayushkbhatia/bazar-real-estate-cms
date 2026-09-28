"use client";

import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Glyph } from "./glyphs";

/**
 * W2's text field (00-foundations §5, TextField): 50px, 15px type, radius 10,
 * an optional fixed prefix ("+971"), a hint under it — replaced by the error
 * when there is one (FE-1's proposed style: a danger border and a 12px danger
 * message).
 */
export const TextField = forwardRef<
  HTMLInputElement,
  Omit<ComponentProps<"input">, "prefix"> & {
    label: string;
    hint?: ReactNode;
    error?: ReactNode;
    prefix?: string;
    /** The accessible name when the prefix belongs in it ("Mobile number, +971"). */
    accessibleLabel?: string;
  }
>(function TextField({ label, hint, error, prefix, accessibleLabel, className, id, ...input }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  const invalid = !!error;
  const field = (
    <input
      ref={ref}
      id={inputId}
      aria-invalid={invalid || undefined}
      aria-describedby={hint || error ? noteId : undefined}
      aria-label={accessibleLabel}
      className={cn(
        "h-[50px] w-full min-w-0 flex-1 border bg-bz-surface px-4 text-[16px] text-bz-ink outline-none transition-colors md:text-[15px]",
        "placeholder:text-bz-muted-2 focus:border-bz-ink-2",
        prefix ? "rounded-e-[10px]" : "rounded-[10px]",
        invalid ? "border-[var(--mrq-badge-error)]" : "border-bz-border",
        className,
      )}
      {...input}
    />
  );
  return (
    <div className="min-w-0">
      <label htmlFor={inputId} className="mb-2 block text-[13px] text-bz-ink">
        {label}
      </label>
      {prefix ? (
        <div className="flex">
          <span
            aria-hidden
            className={cn(
              "flex h-[50px] items-center rounded-s-[10px] border border-e-0 bg-bz-surface-2 px-4 text-[15px] font-medium",
              invalid ? "border-[var(--mrq-badge-error)]" : "border-bz-border",
            )}
          >
            {prefix}
          </span>
          {field}
        </div>
      ) : (
        field
      )}
      {error ? (
        <p id={noteId} className="mt-1.5 flex gap-1.5 text-[12px] leading-[1.45] text-[var(--mrq-danger-fg)]">
          <Glyph name="alert" size={14} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={noteId} className="mt-1 text-[12px] text-bz-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

/** A group label and, under a tile group, the error it owes (FE-1). */
export function GroupError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 flex gap-1.5 text-[12px] leading-[1.45] text-[var(--mrq-danger-fg)]">
      <Glyph name="alert" size={14} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}
