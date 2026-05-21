"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setDealCommission } from "./_actions";

type Props = {
  dealId: string;
  initialCommissionAed: number | null;
  initialNotes: string | null;
};

export function CommissionEditor({
  dealId,
  initialCommissionAed,
  initialNotes,
}: Props) {
  const [commission, setCommission] = useState(
    initialCommissionAed != null ? String(initialCommissionAed) : "",
  );
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, start] = useTransition();

  function onSave() {
    const c = Number(commission);
    if (!Number.isFinite(c) || c < 0) {
      toast.error("Commission must be a positive number.");
      return;
    }
    start(async () => {
      const r = await setDealCommission({
        dealId,
        commissionAed: c,
        notes,
      });
      if (r.status === "error") toast.error(r.message);
      else toast.success("Commission saved.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cm-amount">Commission (AED)</Label>
        <Input
          id="cm-amount"
          type="number"
          step={1000}
          min={0}
          value={commission}
          onChange={(e) => setCommission(e.target.value)}
          placeholder="e.g. 63000"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cm-notes">Notes</Label>
        <Input
          id="cm-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Split, payee, conditions"
        />
      </div>
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={onSave}
        className="self-start"
      >
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
