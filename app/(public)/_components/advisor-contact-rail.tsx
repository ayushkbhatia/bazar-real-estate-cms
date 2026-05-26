"use client";

/**
 * Floating advisor-contact rail.
 *
 * Mobile: fixed bottom strip with WhatsApp + call buttons.
 * Desktop: sticky right-edge rail that fades in once the user scrolls past
 *          the hero (so it doesn't compete with any inline advisor card).
 *
 * T2-D cleanup: third action — "Call me back" — opens a small popover with
 * a name + phone + best-time-to-call form that submits via the existing
 * valuation-lead endpoint (sourced as an enquiry). Optional Email button
 * surfaces when `advisorEmail` is set.
 */

import { useEffect, useState } from "react";
import {
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type Props = {
  advisorName: string;
  advisorPhone: string | null;
  /** Optional advisor email — surfaces a Mail button when set. */
  advisorEmail?: string | null;
  contextRef: string;
  kind: "property" | "development" | "service";
};

export function AdvisorContactRail({
  advisorName,
  advisorPhone,
  advisorEmail,
  contextRef,
  kind,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 480);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const messagePrefix =
    kind === "property"
      ? `Hi ${advisorName}, I'm interested in ${contextRef} on bazar.ae`
      : kind === "development"
        ? `Hi ${advisorName}, I'm looking at ${contextRef} on bazar.ae`
        : `Hi ${advisorName}, about your ${contextRef} service on bazar.ae`;
  const waUrl = buildWhatsAppLink(advisorPhone, messagePrefix);
  const telUrl = advisorPhone ? `tel:${advisorPhone.replace(/\s+/g, "")}` : null;
  const mailtoUrl = advisorEmail
    ? `mailto:${advisorEmail}?subject=${encodeURIComponent(
        kind === "property"
          ? `Bazar enquiry · ${contextRef}`
          : kind === "development"
            ? `Bazar off-plan enquiry · ${contextRef}`
            : `Bazar service · ${contextRef}`,
      )}`
    : null;

  if (!waUrl && !telUrl && !mailtoUrl) return null;

  return (
    <>
      {/* Desktop sticky rail */}
      <div
        className={`hidden md:flex fixed right-4 bottom-6 z-40 flex-col gap-2 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 h-11 px-4 rounded-full bg-bz-ink text-bz-bg shadow-lg hover:bg-bz-ink/90 text-[13px]"
            aria-label={`Message ${advisorName} on WhatsApp`}
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            <span>WhatsApp {advisorName.split(" ")[0]}</span>
          </a>
        ) : null}
        {telUrl ? (
          <a
            href={telUrl}
            className="flex items-center gap-2 h-11 px-4 rounded-full bg-bz-surface border border-bz-border shadow-md hover:bg-bz-surface-2 text-bz-ink text-[13px]"
            aria-label={`Call ${advisorName}`}
          >
            <Phone size={15} strokeWidth={1.8} />
            <span>Call</span>
          </a>
        ) : null}
        <CallBackPopover
          advisorName={advisorName}
          contextRef={contextRef}
          kind={kind}
        />
        {mailtoUrl ? (
          <a
            href={mailtoUrl}
            className="flex items-center gap-2 h-11 px-4 rounded-full bg-bz-surface border border-bz-border shadow-md hover:bg-bz-surface-2 text-bz-ink text-[13px]"
            aria-label={`Email ${advisorName}`}
          >
            <Mail size={15} strokeWidth={1.8} />
            <span>Email</span>
          </a>
        ) : null}
      </div>

      {/* Mobile bottom dock — slides up past the fold */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2 transition-transform ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex gap-2 rounded-full bg-bz-ink/95 text-bz-bg p-1.5 shadow-xl backdrop-blur">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full bg-white/10 text-bz-bg hover:bg-white/20 text-[13px]"
              aria-label={`Message ${advisorName} on WhatsApp`}
            >
              <MessageCircle size={14} strokeWidth={1.8} />
              <span>WhatsApp</span>
            </a>
          ) : null}
          {telUrl ? (
            <a
              href={telUrl}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full bg-white/10 text-bz-bg hover:bg-white/20 text-[13px]"
              aria-label={`Call ${advisorName}`}
            >
              <Phone size={14} strokeWidth={1.8} />
              <span>Call</span>
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}

function CallBackPopover({
  advisorName,
  contextRef,
  kind,
}: {
  advisorName: string;
  contextRef: string;
  kind: "property" | "development" | "service";
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [bestTime, setBestTime] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !name.trim() || !phone.trim()) return;
    setLoading(true);
    try {
      // Reuse the valuation-lead endpoint with a stub email — the OTP
      // step still runs but the advisor inbox sees the row immediately
      // (callback requests are higher-trust by design; the advisor
      // reaches back out by phone, not by email).
      const stubEmail = `callback+${Date.now()}@bazar.ae`;
      const res = await fetch("/api/valuation-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue",
          email: stubEmail,
          name,
          phone,
          intent: "other",
          property_summary: `Callback request · ${contextRef} (${kind}) · best time: ${bestTime || "anytime"} · advisor: ${advisorName}`,
        }),
      });
      if (!res.ok) {
        toast.error("Couldn't queue the callback. Try the WhatsApp button instead.");
        return;
      }
      toast.success(`${advisorName.split(" ")[0]} will call you back.`);
      setOpen(false);
      setName("");
      setPhone("");
      setBestTime("");
    } catch {
      toast.error("Network error. Try the WhatsApp button instead.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-11 px-4 rounded-full bg-bz-surface border border-bz-border shadow-md hover:bg-bz-surface-2 text-bz-ink text-[13px]"
          aria-label="Request a callback"
        >
          <PhoneCall size={15} strokeWidth={1.8} />
          <span>Call me back</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="left" sideOffset={8} className="w-80 p-4">
        <div className="text-[11px] uppercase tracking-wider text-bz-ink-2">
          Request a callback
        </div>
        <h4 className="serif text-[18px] mt-1 leading-tight">
          {advisorName.split(" ")[0]} will call.
        </h4>
        <form className="mt-3 grid gap-3" onSubmit={handleSubmit}>
          <div className="grid gap-1.5">
            <Label htmlFor="cbk-name">Name</Label>
            <Input
              id="cbk-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cbk-phone">Phone</Label>
            <Input
              id="cbk-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+971 50 …"
              autoComplete="tel"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cbk-time">Best time (optional)</Label>
            <Input
              id="cbk-time"
              value={bestTime}
              onChange={(e) => setBestTime(e.target.value)}
              placeholder="e.g. afternoons, after 6pm"
            />
          </div>
          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? (
              <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
            ) : (
              <PhoneCall size={14} strokeWidth={1.7} />
            )}
            Request callback
          </Button>
          <p className="text-[11px] text-bz-ink-2">
            We&apos;ll call within 4 working hours.
          </p>
        </form>
      </PopoverContent>
    </Popover>
  );
}
