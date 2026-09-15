"use client";

/**
 * The property enquiry form in a modal.
 *
 * "Send to advisor" in the action row used to only
 * `scrollIntoView({ block: "center" })` the sidebar card — on mobile, where
 * the sidebar folds below the similar-listings rail, that reads as a dead
 * button. The dialog carries the same `<EnquiryForm>`, stamped with the same
 * `property_id`, so the enquiry it writes is identical to the inline one.
 */

import { useState } from "react";
import { useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ResolvedForm } from "@/lib/forms/types";
import { isolateForLocale } from "@/lib/i18n/bidi";
import { FormRenderer } from "../../../_components/forms/form-renderer";
import { TokenText } from "./token-text";

/**
 * The dialog's own words, from the listing-page copy document
 * (Pages → Sub-pages → Property pages → Enquiry card and dialog).
 *
 * Resolved by the page, because a client component cannot read the document —
 * the same arrangement the shortlist drawer's copy uses. `title` arrives with
 * its tokens filled; `note` arrives as a template so the reference can keep
 * its `.mono` span.
 */
export type EnquiryDialogCopy = {
  title: string;
  note: string;
};

export function PropertyEnquiryDialog({
  form,
  copy,
  propertyId,
  propertyReference,
  advisorName,
  children,
}: {
  /** Resolved from /admin/forms by the listing page. */
  form: ResolvedForm;
  copy: EnquiryDialogCopy;
  propertyId: string;
  propertyReference: string;
  /** Filled into `{advisor}` when the listing has an assigned advisor. */
  advisorName?: string | null;
  /** The trigger — rendered via `asChild`, so pass a single element. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const locale = useLocale();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="serif text-[24px] leading-tight">
            {copy.title}
          </DialogTitle>
          <DialogDescription>
            <TokenText
              template={copy.note}
              tokens={{
                reference: (
                  <span className="mono whitespace-nowrap">
                    {propertyReference}
                  </span>
                ),
                // `<bdi>`: a name may arrive in either script, and without an
                // isolate the comma after it follows whichever side wins.
                advisor: <bdi>{advisorName ?? ""}</bdi>,
              }}
            />
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <FormRenderer
            form={{
              ...form,
              copy: { ...form.copy, title: null, subtitle: null },
            }}
            /* Isolated because this one lands in a textarea, where there is
               no span to hang `.mono` on: the pre-filled message puts the
               reference inside an Arabic sentence, and unisolated it reads
               `09790-BAZ-AD`. Identity under English. */
            tokens={{ reference: isolateForLocale(propertyReference, locale) }}
            context={{ propertyId, propertyReference }}
            successStyle="soft"
            allowAnother
            toastErrors
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
