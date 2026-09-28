import type { ComponentProps, ReactNode } from "react";
import Link from "@/components/i18n/link";
import { cn } from "@/lib/utils";
import { Glyph } from "@/components/mortgage/glyphs";

/**
 * The flow's small parts, at the design's measurements
 * (docs/mortgage/frontend/00-foundations §5). Local rather than the site's
 * shadcn Button: the flow's buttons are 32/40/48/52px with their own radii,
 * and bending the shared primitive to them would move every other button.
 */

// ── Buttons ─────────────────────────────────────────────────────

type ButtonKind = "primary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "cta";

const KIND: Record<ButtonKind, string> = {
  primary: "bg-bz-accent text-white hover:bg-bz-accent-hover",
  outline: "border-bz-border-strong text-bz-ink hover:bg-bz-surface-2",
  ghost: "text-bz-ink-2 hover:bg-bz-surface-2",
};

const SIZE: Record<ButtonSize, string> = {
  // 32px as designed; the touch floor lifts it on a phone.
  sm: "h-8 px-3 text-[12.5px] rounded-[4px] pointer-coarse:min-h-11",
  md: "h-10 px-[18px] text-[13.5px] rounded-md pointer-coarse:min-h-11",
  lg: "h-12 px-6 text-[14px] rounded-md",
  cta: "h-[52px] px-7 text-[15px] rounded-[10px]",
};

export function buttonClass(kind: ButtonKind, size: ButtonSize = "md", className?: string): string {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap border border-transparent font-medium tracking-[-0.005em] transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-ink",
    KIND[kind],
    SIZE[size],
    className,
  );
}

export function FlowButton({
  kind = "outline",
  size = "md",
  className,
  ...rest
}: ComponentProps<"button"> & { kind?: ButtonKind; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(kind, size, className)} {...rest} />;
}

export function FlowLinkButton({
  kind = "outline",
  size = "md",
  className,
  ...rest
}: ComponentProps<typeof Link> & { kind?: ButtonKind; size?: ButtonSize }) {
  return <Link className={buttonClass(kind, size, className)} {...rest} />;
}

// ── Pills ───────────────────────────────────────────────────────

export type Tone = "accent" | "success" | "danger" | "ink" | "muted";

const TONE: Record<Tone, string> = {
  accent: "bg-bz-accent-soft text-bz-accent",
  success: "bg-[var(--mrq-success-bg)] text-[var(--mrq-success-fg)]",
  danger: "bg-[var(--mrq-danger-bg)] text-[var(--mrq-danger-fg)]",
  ink: "bg-bz-ink text-bz-bg",
  muted: "bg-bz-surface-2 text-bz-ink-2",
};

export function Pill({
  tone = "muted",
  small,
  className,
  children,
}: {
  tone?: Tone;
  small?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
        small ? "h-[22px] px-2 text-[11px]" : "h-[26px] px-[11px] text-[12px]",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ── Marks (visual only; the real inputs sit beside them) ────────

export function RadioMark({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className="box-border shrink-0 rounded-full bg-bz-surface"
      style={{
        width: size,
        height: size,
        border: on ? `${Math.round(size * 0.3)}px solid var(--bz-ink)` : "1.5px solid var(--bz-border-strong)",
      }}
    />
  );
}

export function CheckMark({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "box-border grid shrink-0 place-items-center rounded-[5px] border-[1.5px] text-bz-bg",
        on ? "border-transparent bg-bz-ink" : "border-bz-border-strong bg-bz-surface",
      )}
      style={{ width: size, height: size }}
    >
      {on ? <Glyph name="tick" size={Math.round(size * 0.66)} strokeWidth={2.8} /> : null}
    </span>
  );
}

export function Tick({ size = 12, strokeWidth = 2.6 }: { size?: number; strokeWidth?: number }) {
  return <Glyph name="tick" size={size} strokeWidth={strokeWidth} />;
}

// ── Cards ───────────────────────────────────────────────────────

export function RailCard({
  title,
  soft,
  className,
  children,
}: {
  title?: ReactNode;
  soft?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[14px] border border-bz-border",
        soft ? "bg-bz-surface-2 p-5" : "bg-bz-surface p-6",
        className,
      )}
    >
      {title ? (
        <h2 className="serif mb-[18px] text-[25px] leading-[1.1] tracking-[-0.01em]">{title}</h2>
      ) : null}
      {children}
    </section>
  );
}

/** A glyph beside a bold line and a paragraph: the rail's soft notes, W7's WhatsApp line. */
export function NoteRow({
  glyph,
  title,
  children,
  className,
}: {
  glyph: Parameters<typeof Glyph>[0]["name"];
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="mt-px text-bz-accent">
        <Glyph name={glyph} />
      </span>
      <div className="min-w-0">
        {title ? <div className="text-[13.5px] font-semibold">{title}</div> : null}
        <div className={cn("text-[13px] leading-[1.55] text-bz-ink-2", title && "mt-1")}>{children}</div>
      </div>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-px bg-bz-border", className)} />;
}
