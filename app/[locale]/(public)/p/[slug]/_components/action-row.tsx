"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Share2, Send, Check } from "lucide-react";
import { CompareButton } from "@/components/brand/compare-button";
import type { ResolvedForm } from "@/lib/forms/types";
import { PropertyEnquiryDialog, type EnquiryDialogCopy } from "./enquiry-dialog";

/**
 * Sprint 4c: Save / Share / Add-to-compare / Send-to-advisor action row
 * pinned above the gallery on the property detail page.
 *
 * "Send to advisor" opens the enquiry dialog. It used to scroll the sidebar
 * card into view and stop there — no enquiry, and on mobile the target sits
 * below the similar-listings rail, so the button looked broken.
 */
export function PropertyActionRow({
  enquiryForm,
  dialogCopy,
  propertyId,
  reference,
  title,
  advisorName,
}: {
  /** Resolved from /admin/forms by the listing page. */
  enquiryForm: ResolvedForm;
  dialogCopy: EnquiryDialogCopy;
  propertyId: string;
  reference: string;
  title: string;
  /** Named in the dialog copy when the listing has an assigned advisor. */
  advisorName?: string | null;
}) {
  // `property` is on CLIENT_NAMESPACES, so it is already in the browser.
  const t = useTranslations("property");
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="px-4 md:px-12 pt-6 flex items-center justify-between gap-4 flex-wrap">
      {/* `font-mono`, not `.mono`, on the row: under `:lang(ar)` `.mono` also
          forces `direction: ltr`, which put the Arabic label on the wrong side
          of its own reference. Same face either way; the reference carries its
          own isolate instead, so it still reads `BAZ-AD-09790`. */}
      <div className="font-mono text-[11px] uppercase tracking-wider text-bz-muted">
        {t("actions.reference")} ·{" "}
        <bdi className="text-bz-ink">{reference}</bdi>
      </div>
      <div className="flex items-center gap-2">
        <CompareButton propertyId={propertyId} />
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
        >
          {copied ? (
            <>
              <Check size={13} strokeWidth={2} />
              {t("actions.copied")}
            </>
          ) : (
            <>
              <Share2 size={13} strokeWidth={1.7} />
              {t("actions.share")}
            </>
          )}
        </button>
        <PropertyEnquiryDialog
          form={enquiryForm}
          copy={dialogCopy}
          propertyId={propertyId}
          propertyReference={reference}
          advisorName={advisorName}
        >
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bz-accent text-bz-accent-fg text-[12.5px] hover:bg-bz-accent-hover transition-colors"
          >
            <Send size={13} strokeWidth={1.7} />
            {t("actions.sendToAdvisor")}
          </button>
        </PropertyEnquiryDialog>
      </div>
    </div>
  );
}
