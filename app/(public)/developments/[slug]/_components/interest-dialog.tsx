"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EnquiryForm } from "@/app/(public)/_components/enquiry-form";

/**
 * "Register your interest" on a development hero.
 *
 * Replaces a dead "Book a viewing" button — it had no handler, so every click
 * since launch did nothing. Viewings are also the wrong ask for an off-plan
 * project where there is usually nothing standing to view; what the sales team
 * wants from this page is a named lead against a named project.
 *
 * The form is the same one the contact page uses, so the fields, validation and
 * server action stay in one place. Only the framing is project-specific: the
 * title, the pre-filled brief, and `development_id` on the enquiry so the admin
 * queue can tell which project drew the lead.
 */
export function InterestDialog({
  developmentName,
  developmentId,
  buttonLabel,
}: {
  developmentName: string;
  /** Stamped on the enquiry so the admin knows which project page it came from. */
  developmentId: string | null;
  buttonLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-white text-bz-ink hover:bg-white/90">
          <Sparkles size={14} strokeWidth={1.6} />
          {buttonLabel?.trim() || "Register your interest"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          {/* pr-8 keeps a long project name clear of the close button. */}
          <DialogTitle className="serif text-[22px] font-normal pr-8">
            Express your interest in {developmentName}
          </DialogTitle>
          <DialogDescription>
            Leave your details and the advisor for {developmentName} will come
            back with pricing, availability and the payment plan.
          </DialogDescription>
        </DialogHeader>

        <EnquiryForm
          source="development_interest"
          developmentId={developmentId}
          defaultMessage={`I'd like to register my interest in ${developmentName}.`}
          submitLabel="Register my interest"
          successTitle="Interest registered."
          compact
        />
      </DialogContent>
    </Dialog>
  );
}
