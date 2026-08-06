"use client";

import { useState, useTransition } from "react";
import { Download, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createEnquiry } from "@/app/(public)/_actions";

/**
 * Brochure request on a development page.
 *
 * Replaces a Sprint 5a stub that collected an email, waited 500ms and toasted
 * "Sprint 10 wires the real send" — nothing was sent and nothing was stored, so
 * every brochure request since launch was lost.
 *
 * Now it creates a real enquiry carrying `development_id`, so the admin can see
 * which project page the lead came from, and the PDF opens in a new tab rather
 * than being emailed. Name and phone are collected alongside the email because
 * an address on its own isn't an actionable lead.
 */
export function BrochureGate({
  developmentName,
  developmentId,
  brochureUrl,
  buttonLabel,
}: {
  developmentName: string;
  /** Stamped on the enquiry so the admin knows the source page. */
  developmentId: string | null;
  /** From the page's Brochure PDF field. Null ⇒ capture the lead, promise nothing. */
  brochureUrl?: string | null;
  buttonLabel?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Tell us your name.";
    if (!email.includes("@") || email.trim().length < 5)
      next.email = "A valid email, please.";
    // Loose on format — international numbers vary too much to police here,
    // and a rejected real number costs more than a messy stored one.
    if (phone.replace(/\D/g, "").length < 7)
      next.phone = "A contactable phone number, please.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    startTransition(async () => {
      const result = await createEnquiry({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        source: "brochure",
        development_id: developmentId,
        // `message` — not `brief_raw`. The server action validates against
        // enquirySchema and maps message → enquiries.brief_raw itself; sending
        // the column name failed the "Tell us a bit more" check and lost the
        // lead at the last step.
        message: `Brochure request — ${developmentName}.`,
      });
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      // Opening after an await can trip a popup blocker, so the success state
      // below also renders a real link. Belt and braces beats a dead end.
      if (brochureUrl) window.open(brochureUrl, "_blank", "noopener");
      setDone(true);
      toast.success(
        brochureUrl
          ? "Brochure opened in a new tab."
          : `Thanks — an advisor will send the ${developmentName} brochure shortly.`,
      );
    });
  }

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setDone(false);
      setErrors({});
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button>
          <Download size={14} strokeWidth={1.7} />
          {buttonLabel?.trim() || "Download brochure"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {done
              ? `Your ${developmentName} brochure`
              : `Get the ${developmentName} brochure`}
          </DialogTitle>
          <DialogDescription>
            {done
              ? brochureUrl
                ? "It should have opened in a new tab. If your browser blocked it, use the link below."
                : "We've passed your details to the advisor for this project — they'll send the brochure shortly."
              : brochureUrl
                ? "Tell us where to reach you and the PDF opens straight away."
                : "Tell us where to reach you and the advisor for this project will send it over."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col gap-4 px-6 py-3">
            {brochureUrl ? (
              <Button asChild>
                <a href={brochureUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} strokeWidth={1.7} />
                  Open the brochure
                </a>
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => reset(false)}>
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-2">
            <Field
              id="brochure-name"
              label="Full name"
              error={errors.name}
              value={name}
              onChange={setName}
              autoComplete="name"
              autoFocus
            />
            <Field
              id="brochure-email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email}
              value={email}
              onChange={setEmail}
              autoComplete="email"
            />
            <Field
              id="brochure-phone"
              label="Phone number"
              type="tel"
              placeholder="+971 50 123 4567"
              error={errors.phone}
              value={phone}
              onChange={setPhone}
              autoComplete="tel"
            />
            <DialogFooter className="px-0">
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Sending…"
                  : brochureUrl
                    ? "Open the brochure"
                    : "Request the brochure"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="mt-1.5"
      />
      {error ? (
        <p className="mt-1 text-[11.5px] text-[oklch(0.45_0.13_28)]">{error}</p>
      ) : null}
    </div>
  );
}
