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
import type { ResolvedForm } from "@/lib/forms/types";
import { renderFormCopy } from "@/lib/forms/resolve";
import { FormRenderer } from "@/app/[locale]/(public)/_components/forms/form-renderer";

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
  form,
  developmentName,
  developmentId,
  buttonLabel,
}: {
  /** Resolved from /admin/forms by the project page. */
  form: ResolvedForm;
  developmentName: string;
  /** Stamped on the enquiry so the admin knows which project page it came from. */
  developmentId: string | null;
  buttonLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const tokens = { project: developmentName };
  // The dialog header owns the title and the blurb, so the body must not
  // render them a second time.
  const body: ResolvedForm = {
    ...form,
    copy: { ...form.copy, title: null, subtitle: null },
  };

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
          <DialogTitle className="serif text-[22px] font-normal pe-8">
            {renderFormCopy(form.copy.title, tokens)}
          </DialogTitle>
          <DialogDescription>
            {renderFormCopy(form.copy.subtitle, tokens)}
          </DialogDescription>
        </DialogHeader>

        <FormRenderer
          form={body}
          tokens={tokens}
          context={{ developmentId, developmentName }}
          successStyle="soft"
          allowAnother
          toastErrors
        />
      </DialogContent>
    </Dialog>
  );
}
