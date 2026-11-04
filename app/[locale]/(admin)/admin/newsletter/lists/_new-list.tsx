"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createList } from "./_actions";

const INPUT = "w-full border border-bz-border rounded p-2 text-[13px] bg-bz-bg outline-none focus:border-bz-accent";

export function NewListButton() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", description: "" });
  const [busy, start] = useTransition();

  function create() {
    start(async () => {
      // Redirects to the new list on success.
      const r = await createList(values);
      if (r?.status === "error") toast.error(r.fieldErrors?.name ?? r.message);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={1.8} /> New list
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>New list</DialogTitle>
            <DialogDescription>Name it for the people on it. You&apos;ll upload the addresses next.</DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Name</span>
            <input
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              maxLength={120}
              placeholder="Yas Island launch event guests"
              className={INPUT}
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-bz-ink-2">Description</span>
            <textarea
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              maxLength={400}
              rows={2}
              placeholder="Optional — where the addresses came from"
              className={INPUT}
            />
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={busy || !values.name.trim()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Create list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
