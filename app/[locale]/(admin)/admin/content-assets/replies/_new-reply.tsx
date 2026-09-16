"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createFormReply } from "./_actions";

/** Name it, and the editor opens on Bazar's wording as a draft. */
export function NewReplyButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  function create() {
    start(async () => {
      const result = await createFormReply(name);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      setName("");
      if (result.id) router.push(`/admin/content-assets/replies/${result.id}`);
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={1.8} />
        New reply
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>New form reply</DialogTitle>
            <DialogDescription>
              A whole email you can point any lead form at. It starts as a draft
              carrying Bazar&apos;s acknowledgement, so nothing changes until you
              publish it and assign it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reply-name">Name</Label>
            <Input
              id="reply-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Brochure request reply"
              className="h-8 text-[12.5px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim().length >= 3) create();
              }}
            />
            <span className="text-[11px] text-bz-muted">
              Only the team sees this. The visitor sees the subject line.
            </span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={create}
              disabled={pending || name.trim().length < 3}
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : null}
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
