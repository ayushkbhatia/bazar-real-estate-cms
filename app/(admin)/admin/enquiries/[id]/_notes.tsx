"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateInternalNotes } from "../_actions";

export function NotesEditor({
  enquiryId,
  initial,
}: {
  enquiryId: string;
  initial: string | null;
}) {
  const [text, setText] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const dirty = text !== (initial ?? "");

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Internal notes only — never shown to the lead."
        className="border border-bz-border rounded p-2 text-[13px] bg-bz-surface focus:border-bz-accent outline-none resize-y"
      />
      <Button
        type="button"
        size="sm"
        disabled={pending || !dirty}
        onClick={() => {
          start(async () => {
            const r = await updateInternalNotes(enquiryId, text);
            if (r.status === "error") toast.error(r.message);
            else toast.success(r.message ?? "Saved.");
          });
        }}
        className="self-end"
      >
        <Save size={13} strokeWidth={1.8} />
        {pending ? "Saving…" : "Save notes"}
      </Button>
    </div>
  );
}
