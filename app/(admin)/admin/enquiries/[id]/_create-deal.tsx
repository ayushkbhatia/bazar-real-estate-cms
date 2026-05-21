"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDealFromEnquiry } from "../../deals/_actions";

type Props = {
  enquiryId: string;
  defaultPriceAed: number | null;
};

export function CreateDealButton({ enquiryId, defaultPriceAed }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();

  const [price, setPrice] = useState(
    defaultPriceAed ? String(defaultPriceAed) : "",
  );
  const [feePct, setFeePct] = useState("1.5");
  const [notes, setNotes] = useState("");

  function onConfirm() {
    const priceAed = Number(price);
    const advisoryFeePct = Number(feePct);
    if (!Number.isFinite(priceAed) || priceAed <= 0) {
      toast.error("Enter a valid sale price in AED.");
      return;
    }
    if (!Number.isFinite(advisoryFeePct) || advisoryFeePct < 0) {
      toast.error("Enter a valid advisory fee percentage.");
      return;
    }
    start(async () => {
      const r = await createDealFromEnquiry({
        enquiryId,
        priceAed,
        advisoryFeePct,
        notes: notes.trim() === "" ? null : notes,
      });
      if (r.status === "error") {
        toast.error(r.message);
        return;
      }
      toast.success("Deal opened at MoU stage.");
      setOpen(false);
      router.push(`/admin/deals/${r.dealId}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Handshake size={13} strokeWidth={1.8} />
          Create deal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a deal</DialogTitle>
          <DialogDescription>
            Promotes this won enquiry into a transaction file. The lead
            agent defaults to whoever is already assigned. Stage starts at
            MoU.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cd-price">Agreed sale price (AED)</Label>
            <Input
              id="cd-price"
              type="number"
              step={1000}
              min={100000}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 4200000"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cd-fee">Advisory fee (% of price)</Label>
            <Input
              id="cd-fee"
              type="number"
              step={0.1}
              min={0}
              max={10}
              value={feePct}
              onChange={(e) => setFeePct(e.target.value)}
            />
            <span className="text-[11.5px] text-bz-muted">
              {(() => {
                const p = Number(price);
                const f = Number(feePct);
                if (!Number.isFinite(p) || !Number.isFinite(f) || p <= 0)
                  return "Fee preview appears when both fields are valid.";
                const fee = Math.round((p * f) / 100);
                return `Fee preview: AED ${fee.toLocaleString()}`;
              })()}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cd-notes">Notes (optional)</Label>
            <Input
              id="cd-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any commission split, internal context, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} disabled={pending}>
            {pending ? "Opening…" : "Open deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
