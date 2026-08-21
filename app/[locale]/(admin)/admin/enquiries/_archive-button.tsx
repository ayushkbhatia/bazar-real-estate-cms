"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Archive, ArchiveRestore } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { setEnquiryArchived } from "./_actions";

type Props = {
  enquiryId: string;
  /** The lead's name — quoted back in the confirmation so a mis-click on a
   *  dense list is caught before it lands. */
  name: string;
  archived: boolean;
  /** `icon` for the list rows, `button` for the detail header. */
  presentation?: "icon" | "button";
};

/**
 * Archive / restore one enquiry. Rendered only for admins — see
 * `ENQUIRY_ARCHIVE_ROLES` in `_actions.ts`; the server action and migration
 * 0116's trigger both re-check, this only decides what the page offers.
 *
 * Archiving asks first because it removes the lead from every advisor's
 * inbox. Restoring doesn't: it is the undo, and putting a dialog in front of
 * an undo just makes the mistake harder to walk back.
 */
export function ArchiveEnquiryButton({
  enquiryId,
  name,
  archived,
  presentation = "icon",
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function run(next: boolean) {
    start(async () => {
      const r = await setEnquiryArchived(enquiryId, next);
      if (r.status === "error") toast.error(r.message);
      else {
        toast.success(r.message ?? "Done.");
        setOpen(false);
      }
    });
  }

  if (archived) {
    return presentation === "icon" ? (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={`Restore ${name} to the inbox`}
        title="Restore to the inbox"
        onClick={() => run(false)}
      >
        <ArchiveRestore size={14} strokeWidth={1.8} />
      </Button>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => run(false)}
      >
        <ArchiveRestore size={13} strokeWidth={1.8} />
        {pending ? "Restoring…" : "Restore"}
      </Button>
    );
  }

  return (
    <>
      {presentation === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={pending}
          aria-label={`Archive ${name}`}
          title="Archive"
          onClick={() => setOpen(true)}
        >
          <Archive size={14} strokeWidth={1.8} />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setOpen(true)}
        >
          <Archive size={13} strokeWidth={1.8} />
          Archive
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this enquiry?</DialogTitle>
            <DialogDescription>
              {name} drops out of the inbox, the pipeline board and the
              dashboard counts, and stops triggering escalation. Nothing is
              deleted — the conversation and history stay, and an admin can
              restore it from the Archived tab.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => run(true)} disabled={pending}>
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
