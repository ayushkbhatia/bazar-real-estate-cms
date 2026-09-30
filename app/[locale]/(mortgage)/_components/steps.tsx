"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Tick } from "./primitives";

/**
 * The stepper, the headings and the two numbered lists
 * (00-foundations §5: FlowStepper, FlowHeading, ConfirmationHeading,
 * NextSteps, ProgressTrack).
 */

/** Three steps; `step` 0–2 is the current one, 3 means all done (W4, W7). */
export function FlowStepper({ step, last }: { step: number; last: "documents" | "submit" }) {
  const t = useTranslations("mortgage");
  const labels = [t("stepper.chooseService"), t("stepper.yourDetails"), last === "documents" ? t("stepper.documents") : t("stepper.submit")];
  return (
    <ol aria-label={t("stepper.label")} className="flex items-center gap-x-2.5 sm:gap-x-3.5">
      {labels.map((label, i) => {
        const state = i < step ? "done" : i === step ? "now" : "todo";
        return (
          <li key={i} aria-current={state === "now" ? "step" : undefined} className="flex items-center gap-2.5 sm:gap-3.5">
            {i > 0 ? (
              <span
                aria-hidden
                className={cn("h-px w-6 sm:w-10", i <= step ? "bg-bz-ink-2" : "bg-bz-border-strong")}
              />
            ) : null}
            <span className="flex items-center gap-[9px]">
              <span
                aria-hidden
                className={cn(
                  "mono box-border grid size-6 place-items-center rounded-full border text-[11px]",
                  state === "now" && "border-transparent bg-bz-ink text-bz-bg",
                  state === "done" && "border-transparent bg-bz-accent-soft text-bz-accent",
                  state === "todo" && "border-bz-border-strong text-bz-muted",
                )}
              >
                {state === "done" ? <Tick /> : i + 1}
              </span>
              {/* On a phone only the current step is named; the others are still read out. */}
              <span
                className={cn(
                  "text-[13px] whitespace-nowrap",
                  state === "now" ? "font-medium text-bz-ink" : state === "done" ? "text-bz-ink" : "text-bz-muted",
                  state !== "now" && "max-sm:sr-only",
                )}
              >
                {label}
                {state === "done" ? <span className="sr-only"> ({t("stepper.done")})</span> : null}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Focus the page's h1 once, so a step change is announced where the reader is. */
function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return ref;
}

export function FlowHeading({ eyebrow, title, lede }: { eyebrow: ReactNode; title: ReactNode; lede?: ReactNode }) {
  const ref = useFocusOnMount<HTMLHeadingElement>();
  return (
    <>
      <div className="eyebrow">{eyebrow}</div>
      <h1
        ref={ref}
        tabIndex={-1}
        className="serif mt-3 max-w-[680px] text-[40px] leading-[1.02] tracking-[-0.025em] text-balance outline-none md:text-[54px]"
      >
        {title}
      </h1>
      {lede ? (
        <p className="mt-4 max-w-[620px] text-[16px] leading-[1.6] text-bz-ink-2 text-pretty">{lede}</p>
      ) : null}
    </>
  );
}

export function ConfirmationHeading({ eyebrow, title, body }: { eyebrow: ReactNode; title: ReactNode; body: ReactNode }) {
  const ref = useFocusOnMount<HTMLHeadingElement>();
  return (
    <>
      <span className="grid size-14 place-items-center rounded-full bg-bz-accent-soft text-bz-accent" aria-hidden>
        <Tick size={24} strokeWidth={2.2} />
      </span>
      <div className="eyebrow mt-7">{eyebrow}</div>
      <h1
        ref={ref}
        tabIndex={-1}
        className="serif mt-3 text-[44px] leading-none tracking-[-0.025em] outline-none md:text-[60px]"
      >
        {title}
      </h1>
      <p className="mt-4 max-w-[620px] text-[18px] leading-[1.55] text-bz-ink-2 text-pretty">{body}</p>
    </>
  );
}

/** "What happens next": numbered rows with a bold lead (W3, W5, W6). */
export function NextSteps({ items }: { items: readonly ReactNode[] }) {
  return (
    <ol>
      {items.map((item, i) => (
        <li
          key={i}
          className={cn("flex gap-3.5", i > 0 && "mt-3.5 border-t border-bz-border pt-3.5")}
        >
          <span
            aria-hidden
            className="mono grid size-[26px] shrink-0 place-items-center rounded-full bg-bz-surface-2 text-[11px] text-bz-ink-2"
          >
            {i + 1}
          </span>
          <span className="pt-[3px] text-[13.5px] leading-[1.5] text-bz-ink-2 text-pretty">{item}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * The progress track on W4 and W7: equal cells, the first done, the second
 * now. Stacks under 1024px (proposed; not designed).
 */
export function ProgressTrack({ items }: { items: readonly { body: ReactNode; meta?: ReactNode }[] }) {
  const t = useTranslations("mortgage");
  return (
    <ol
      className="grid rounded-[14px] border border-bz-border bg-bz-surface lg:[grid-template-columns:repeat(var(--cells),minmax(0,1fr))]"
      style={{ ["--cells" as string]: items.length }}
    >
      {items.map((item, i) => {
        const state = i < 1 ? "done" : i === 1 ? "now" : "todo";
        return (
          <li
            key={i}
            className={cn("px-[22px] pt-5 pb-[22px]", i > 0 && "border-t border-bz-border lg:border-t-0 lg:border-s")}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={cn(
                  "mono box-border grid size-6 place-items-center rounded-full border text-[11px]",
                  state === "done" && "border-transparent bg-bz-accent-soft text-bz-accent",
                  state === "now" && "border-transparent bg-bz-ink text-bz-bg",
                  state === "todo" && "border-bz-border-strong text-bz-muted",
                )}
              >
                {state === "done" ? <Tick /> : i + 1}
              </span>
              <span className={cn("eyebrow text-[10.5px]", state === "now" ? "text-bz-ink" : "text-bz-muted")}>
                {state === "done" ? t("track.done") : state === "now" ? t("track.now") : t("track.next")}
              </span>
            </div>
            <div className="mt-3.5 text-[13.5px] leading-[1.5] text-bz-ink-2 text-pretty">{item.body}</div>
            {item.meta ? <div className="mono mt-2 text-[11px] text-bz-muted">{item.meta}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}
