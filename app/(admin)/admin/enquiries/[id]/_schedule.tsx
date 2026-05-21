"use client";

import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";
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
import { createViewing } from "./_actions-viewing";

type Props = { enquiryId: string };

export function ScheduleViewingButton({ enquiryId }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [startsAt, setStartsAt] = useState(defaultStartsAt());
  const [duration, setDuration] = useState(45);
  const [location, setLocation] = useState("");

  function onConfirm() {
    start(async () => {
      const iso = new Date(startsAt).toISOString();
      const r = await createViewing({
        enquiryId,
        startsAtIso: iso,
        durationMinutes: duration,
        location: location.trim() === "" ? undefined : location.trim(),
      });
      if (r.status === "error") toast.error(r.message);
      else {
        toast.success("Viewing booked — calendar invite emailed.");
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Calendar size={13} strokeWidth={1.8} />
          Schedule viewing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule a viewing</DialogTitle>
          <DialogDescription>
            We&apos;ll create a tentative viewing record and email the lead
            a calendar invite.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sv-when">Date &amp; time</Label>
            <Input
              id="sv-when"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <span className="text-[11.5px] text-bz-muted">
              Local time. Will be saved as UTC.
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sv-duration">Duration (minutes)</Label>
            <Input
              id="sv-duration"
              type="number"
              step={15}
              min={15}
              max={240}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sv-location">Location (optional)</Label>
            <Input
              id="sv-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Falls back to property address."
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
            {pending ? "Booking…" : "Book"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function defaultStartsAt(): string {
  // Tomorrow at 10:00 local, formatted for datetime-local input.
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
