"use client";

import { useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ResolvedForm } from "@/lib/forms/types";
import { renderFormCopy } from "@/lib/forms/resolve";
import { FormRenderer } from "@/app/[locale]/(public)/_components/forms/form-renderer";

/**
 * Brochure request on a development page.
 *
 * Creates a real enquiry carrying `development_id`, so the admin can see which
 * project page the lead came from, and the PDF opens in a new tab rather than
 * being emailed. Name and phone are collected alongside the email because an
 * address on its own isn't an actionable lead — though that is now the
 * editor's call: the three fields are the registry defaults for
 * `development_brochure` and can be changed at /admin/forms.
 *
 * The two copy variants that depended on whether a PDF exists stay in code:
 * "the PDF opens straight away" versus "the advisor will send it over" is not
 * a wording choice, it is a description of what is about to happen.
 */
export function BrochureGate({
  form,
  developmentName,
  developmentId,
  brochureUrl,
  buttonLabel,
}: {
  /** Resolved from /admin/forms by the project page. */
  form: ResolvedForm;
  developmentName: string;
  /** Stamped on the enquiry so the admin knows the source page. */
  developmentId: string | null;
  /** From the page's Brochure PDF field. Null ⇒ capture the lead, promise nothing. */
  brochureUrl?: string | null;
  buttonLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);

  const tokens = { project: developmentName };
  const body: ResolvedForm = {
    ...form,
    copy: { ...form.copy, title: null, subtitle: null },
  };

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setDone(false);
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button>
          <Download size={14} strokeWidth={1.7} />
          {buttonLabel?.trim() || "Download brochure"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {done
              ? renderFormCopy(form.copy.success_title, tokens)
              : renderFormCopy(form.copy.title, tokens)}
          </DialogTitle>
          <DialogDescription>
            {done
              ? brochureUrl
                ? "It should have opened in a new tab. If your browser blocked it, use the link below."
                : renderFormCopy(form.copy.success_body, tokens)
              : brochureUrl
                ? "Tell us where to reach you and the PDF opens straight away."
                : "Tell us where to reach you and the advisor for this project will send it over."}
          </DialogDescription>
        </DialogHeader>

        {done && brochureUrl ? (
          <div className="flex flex-col gap-4 px-6 py-3">
            <Button asChild>
              <a href={brochureUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} strokeWidth={1.7} />
                Open the brochure
              </a>
            </Button>
            <Button variant="outline" onClick={() => reset(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="px-6 py-2">
            <FormRenderer
              form={body}
              tokens={tokens}
              context={{ developmentId, developmentName }}
              successStyle="soft"
              toastErrors
              copyOverride={
                brochureUrl ? { submit_label: "Open the brochure" } : undefined
              }
              onSuccess={() => {
                setDone(true);
                // Opening after an await can trip a popup blocker, so the
                // success state above also renders a real link. Belt and
                // braces beats a dead end.
                if (brochureUrl) window.open(brochureUrl, "_blank", "noopener");
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
