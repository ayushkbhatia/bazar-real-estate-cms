"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { buttonClass, FlowLinkButton } from "./primitives";

/**
 * The action bar under each step (00-foundations §5, FlowActions): Back, a
 * note, the primary CTA, optional fine print. A disabled CTA stays focusable
 * (`aria-disabled`) with the note as its description, so a screen reader
 * hears why it can't be pressed. Below 768px the bar stacks: Back on top,
 * then a full-width CTA (proposed; not designed).
 */
export function FlowActions({
  backHref,
  note,
  noteId,
  cta,
  onCta,
  arrow,
  disabled,
  busy,
  fine,
  fineId,
}: {
  backHref?: string;
  note?: ReactNode;
  noteId?: string;
  cta: string;
  onCta: () => void;
  arrow?: boolean;
  disabled?: boolean;
  busy?: boolean;
  fine?: ReactNode;
  fineId?: string;
}) {
  const t = useTranslations("mortgage");
  const describedBy = [note && noteId, fine && fineId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="mt-9 border-t border-bz-border pt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-[18px]">
        {backHref ? (
          <FlowLinkButton kind="ghost" href={backHref} className="self-start md:self-auto">
            <ArrowLeft size={16} strokeWidth={1.6} className="rtl:-scale-x-100" aria-hidden />
            {t("actions.back")}
          </FlowLinkButton>
        ) : null}
        <div className="hidden flex-1 md:block" />
        {note ? (
          <div id={noteId} className="text-[13px] text-bz-muted md:text-end">
            {note}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (!disabled && !busy) onCta();
          }}
          aria-disabled={disabled || busy || undefined}
          aria-busy={busy || undefined}
          aria-describedby={describedBy}
          className={cn(
            buttonClass("primary", "cta"),
            "w-full md:w-auto",
            (disabled || busy) && "cursor-not-allowed",
            disabled && "bg-bz-surface-3 text-bz-muted hover:bg-bz-surface-3",
          )}
        >
          {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {cta}
          {arrow && !busy ? <ArrowRight size={16} strokeWidth={1.6} className="rtl:-scale-x-100" aria-hidden /> : null}
          {busy ? <span className="sr-only">{t("submit.sending")}</span> : null}
        </button>
      </div>
      {fine ? (
        <div id={fineId} className="mt-3.5 text-[12px] text-bz-muted md:text-end">
          {fine}
        </div>
      ) : null}
    </div>
  );
}
