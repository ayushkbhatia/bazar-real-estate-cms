"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CampaignDraft } from "@/lib/newsletter/campaign";
import { saveAsTemplate } from "../_actions";

const INPUT = "w-full border border-bz-border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent";

/**
 * "Save as template": this newsletter's blocks, words (both languages),
 * colours, images, subject and preview line, kept to start the next one
 * from. Unsaved edits are included — what's on screen is what's kept.
 */
export function SaveTemplateDialog({ open, draft, onClose }: { open: boolean; draft: CampaignDraft; onClose: () => void }) {
  const [name, setName] = useState(draft.subject);
  const [description, setDescription] = useState("");
  const [busy, start] = useTransition();

  function save() {
    start(async () => {
      const r = await saveAsTemplate(draft, { name, description });
      if (r.status === "error") {
        toast.error(r.message);
        return;
      }
      toast.success(r.message);
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Save as a template</DialogTitle>
          <DialogDescription>
            Every block, its words in English and Arabic, the colours and pictures, and the subject — ready to start the
            next newsletter from. It appears under New newsletter → Your templates.
          </DialogDescription>
        </DialogHeader>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-bz-ink-2">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Waterfront launch" className={INPUT} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-bz-ink-2">What it&apos;s for</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} rows={2} placeholder="Optional" className={INPUT} />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
