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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EnquiryForm } from "../../../_components/enquiry-form";

export function PropertyEnquiryDialog({
  propertyId,
  propertyReference,
  propertyTitle,
  advisorName,
  children,
}: {
  propertyId: string;
  propertyReference: string;
  propertyTitle: string;
  /** Named in the dialog copy when the listing has an assigned advisor. */
  advisorName?: string | null;
  /** The trigger — rendered via `asChild`, so pass a single element. */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[520px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="serif text-[24px] leading-tight">
            Enquire about {propertyTitle}
          </DialogTitle>
          <DialogDescription>
            Reference <span className="mono">{propertyReference}</span>
            {advisorName ? (
              <>
                {" "}
                · goes straight to {advisorName}, the advisor on this listing.
              </>
            ) : (
              <> · an advisor replies within 2 hours during office hours.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <EnquiryForm
            source="property_page"
            propertyId={propertyId}
            propertyReference={propertyReference}
            submitLabel="Send enquiry"
            compact
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
