"use client";

import { useState, useTransition } from "react";
import { Calendar, Clock } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitTourRequest } from "./_actions";

/**
 * Sprint 4c: date + time picker for the property page sidebar.
 * Sprint 9: persists via createTourRequest() — submissions land in
 * tour_requests and surface on /account/saved → Tour requests.
 */
export function ScheduleViewing({
  propertyId,
  propertyReference,
}: {
  propertyId: string;
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
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Name + phone required.");
      return;
    }
    startTransition(async () => {
      const result = await submitTourRequest({
        property_id: propertyId,
        full_name: name.trim(),
        phone: phone.trim(),
        preferred_date: date,
        preferred_time: time,
        message: null,
      });
      if (result.ok) {
        toast.success(
          `Viewing request for ${propertyReference} on ${date} at ${time} sent.`,
        );
        setName("");
        setPhone("");
      } else {
        toast.error(result.error);
      }
    });
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
          An advisor confirms within 2 hours during office hours.
        </p>
      </form>
    </div>
  );
}
