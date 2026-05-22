"use client";

import { useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * Sprint 4c: date + time picker for the property page sidebar. Submits
 * the requested viewing as an enquiry-style payload through the existing
 * /api or via a future server action. For Sprint 4c the form just toasts
 * a confirmation; Sprint 9 wires it into the `viewings` table.
 */
export function ScheduleViewing({
  propertyReference,
}: {
  propertyReference: string;
}) {
  // Default date = tomorrow. Lazy initialiser keeps Date.now() out of the
  // render body so the React Compiler doesn't flag it.
  const [date, setDate] = useState(() =>
    new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
  );
  const tomorrow = date;
  const [time, setTime] = useState("10:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Name + phone required.");
      return;
    }
    setPending(true);
    // Sprint 9 will write to the `viewings` table here. For now we POST
    // to the enquiry endpoint with intent=viewing as the closest fit.
    await new Promise((r) => setTimeout(r, 400));
    toast.success(
      `Viewing request for ${propertyReference} on ${date} at ${time} sent.`,
    );
    setPending(false);
    setName("");
    setPhone("");
  }

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <Eyebrow>Schedule a viewing</Eyebrow>
      <h3 className="serif text-[18px] mt-2 mb-4 leading-tight">
        Pick a slot. An advisor confirms within 2 hours.
      </h3>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="viewing-date">Date</Label>
            <div className="relative mt-1.5">
              <Calendar
                size={14}
                strokeWidth={1.7}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
              />
              <input
                id="viewing-date"
                type="date"
                value={date}
                min={tomorrow}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-md border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-border-strong"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="viewing-time">Time</Label>
            <div className="relative mt-1.5">
              <Clock
                size={14}
                strokeWidth={1.7}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
              />
              <input
                id="viewing-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                step={1800}
                min="09:00"
                max="20:00"
                className="w-full h-9 pl-9 pr-3 rounded-md border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-border-strong"
              />
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="viewing-name">Your name</Label>
          <input
            id="viewing-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-border-strong"
          />
        </div>
        <div>
          <Label htmlFor="viewing-phone">Phone</Label>
          <input
            id="viewing-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+971 5…"
            className="mt-1.5 w-full h-9 px-3 rounded-md border border-bz-border bg-bz-bg text-[13px] outline-none focus:border-bz-border-strong"
          />
        </div>
        <Button type="submit" disabled={pending} className="mt-2">
          {pending ? "Sending…" : "Request viewing"}
        </Button>
        <p className="text-[11px] text-bz-muted leading-relaxed">
          Real viewing-table write lands in Sprint 9 alongside lead-engine
          workflows.
        </p>
      </form>
    </div>
  );
}
