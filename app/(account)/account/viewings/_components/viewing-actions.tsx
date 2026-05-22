"use client";

import { useState, useTransition } from "react";
import { Download, X, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ViewingRef = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  propertyReference: string | null;
  propertyTitle: string | null;
  location: string | null;
};

/**
 * Sprint 6: action row beneath each upcoming viewing.
 * - Add to calendar (.ics) — client-generated, browser downloads
 * - Reschedule — dialog with date+time (writes via Sprint 9 server action)
 * - Cancel — dialog confirm (writes via Sprint 9 server action)
 */
export function ViewingActions({ viewing }: { viewing: ViewingRef }) {
  function downloadIcs() {
    const ics = makeIcs(viewing);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bazar-viewing-${viewing.id.slice(0, 8)}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-3 flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={downloadIcs}
        className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-bz-border bg-bz-bg text-[12px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
      >
        <Download size={12} strokeWidth={1.7} />
        Add to calendar
      </button>
      <RescheduleDialog viewing={viewing} />
      <CancelDialog viewing={viewing} />
    </div>
  );
}

function RescheduleDialog({ viewing }: { viewing: ViewingRef }) {
  const [open, setOpen] = useState(false);
  const startsAt = new Date(viewing.startsAt);
  const defaultDate = startsAt.toISOString().slice(0, 10);
  const defaultTime = startsAt.toISOString().slice(11, 16);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  // Lazy initialiser keeps Date.now() out of the render body so the React
  // Compiler doesn't flag it.
  const [tomorrow] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 350));
      toast.success(
        `Reschedule requested for ${date} ${time}. Sprint 9 wires the real write.`,
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-bz-border bg-bz-bg text-[12px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
        >
          <RotateCcw size={12} strokeWidth={1.7} />
          Reschedule
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule viewing</DialogTitle>
          <DialogDescription>
            Pick a new date and time. Your advisor confirms within 2 hours.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="px-6 pb-2 grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="re-date">Date</Label>
            <input
              id="re-date"
              type="date"
              value={date}
              min={tomorrow}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px]"
            />
          </div>
          <div>
            <Label htmlFor="re-time">Time</Label>
            <input
              id="re-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              min="09:00"
              max="20:00"
              step={1800}
              className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px]"
            />
          </div>
          <DialogFooter className="col-span-2 px-0 mt-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Request reschedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ viewing }: { viewing: ViewingRef }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 350));
      toast.success(
        `Cancellation noted. Sprint 9 wires the real viewing cancel.`,
      );
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-bz-border bg-bz-bg text-[12px] text-bz-danger hover:bg-red-50 transition-colors"
        >
          <X size={12} strokeWidth={1.8} />
          Cancel
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this viewing?</DialogTitle>
          <DialogDescription>
            We&apos;ll notify your advisor immediately. You can request a new
            viewing for{" "}
            {viewing.propertyReference ? (
              <span className="mono">{viewing.propertyReference}</span>
            ) : (
              "this property"
            )}{" "}
            any time.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep viewing
          </Button>
          <Button
            onClick={confirm}
            disabled={pending}
            className="bg-bz-danger hover:bg-bz-danger/90"
          >
            {pending ? "Cancelling…" : "Cancel viewing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function makeIcs(v: ViewingRef): string {
  const start = new Date(v.startsAt);
  const end = new Date(start.getTime() + v.durationMinutes * 60_000);
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const title = v.propertyTitle
    ? `Viewing · ${v.propertyTitle}`
    : "Property viewing";
  const summary = v.propertyReference
    ? `${title} (${v.propertyReference})`
    : title;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bazar Real Estate//Viewings//EN",
    "BEGIN:VEVENT",
    `UID:${v.id}@bazar.ae`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${summary}`,
    v.location ? `LOCATION:${v.location.replace(/\n/g, " ")}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
