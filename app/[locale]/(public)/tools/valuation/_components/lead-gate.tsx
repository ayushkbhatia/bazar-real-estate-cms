"use client";

/**
 * T1-E: Lead-gate modal that sits on the valuation page. The user sees their
 * instant estimate first (the dopamine hit). Clicking "Get the full advisor
 * report" opens this modal, which collects email + optional phone + intent,
 * sends an OTP, and on verify enqueues the lead + emails the prepared
 * report follow-up.
 */

import { useState } from "react";
import { Check, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResolvedForm } from "@/lib/forms/types";

type Props = {
  /**
   * The `valuation_report_gate` form from /admin/forms. Optional so the gate
   * still renders on a surface that hasn't been wired yet; when supplied, its
   * heading, blurb, button and small print are the editor's. The inputs stay
   * in code — the OTP step in the middle is behaviour, not copy.
   */
  form?: ResolvedForm;
  /** Midpoint AED estimate from the wizard, used in the confirmation copy. */
  valuationAed?: number | null;
  /** Short one-liner about the property, used to pre-fill the brief. */
  propertySummary?: string;
  /** Override label for the trigger button. */
  triggerLabel?: string;
};

type Step = "form" | "verify" | "done";

export function ValuationLeadGate({
  form,
  valuationAed,
  propertySummary,
  triggerLabel = "Get the full advisor report",
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState<"sell" | "refinance" | "curious" | "other">("curious");
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/valuation-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "issue",
          email,
          phone: phone || undefined,
          name: name || undefined,
          intent,
          valuation_aed: valuationAed ?? undefined,
          property_summary: propertySummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not send code.");
        return;
      }
      // Dev-only echo so we can hand-test without Resend.
      if (data.debug_code) setDebugCode(data.debug_code);
      setStep("verify");
      toast.success("Code sent — check your inbox.");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (loading || code.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch("/api/valuation-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email,
          code,
          phone: phone || undefined,
          name: name || undefined,
          intent,
          valuation_aed: valuationAed ?? undefined,
          property_summary: propertySummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Verification failed.");
        return;
      }
      setStep("done");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          // Reset state on close so re-open is clean.
          setStep("form");
          setCode("");
          setDebugCode(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="serif text-[26px] leading-tight">
                {form?.copy.title ?? "Get the full advisor report"}
              </DialogTitle>
              <DialogDescription className="text-bz-ink-2">
                {form?.copy.subtitle ??
                  "A Bazar advisor reviews the instant estimate against the latest comparables and sends you the prepared PDF within 24 hours."}
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4 mt-3" onSubmit={handleIssue}>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-email">Email</Label>
                <Input
                  id="vlg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-name">Name (optional)</Label>
                <Input
                  id="vlg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="So we know how to address the report"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-phone">Phone (optional)</Label>
                <Input
                  id="vlg-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+971 50 …"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-intent">I&apos;m thinking about…</Label>
                <select
                  id="vlg-intent"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={intent}
                  onChange={(e) =>
                    setIntent(e.target.value as typeof intent)
                  }
                >
                  <option value="curious">Just curious about value</option>
                  <option value="sell">Selling soon</option>
                  <option value="refinance">Refinancing</option>
                  <option value="other">Something else</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="mt-2">
                {loading ? (
                  <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Mail size={14} strokeWidth={1.7} />
                )}
                {loading
                  ? (form?.copy.pending_label ?? "Sending…")
                  : (form?.copy.submit_label ?? "Email me a code")}
              </Button>
              {form?.copy.consent_note === null ? null : (
                <p className="text-[11.5px] text-bz-muted">
                  {form?.copy.consent_note ??
                    "We use your email for the verification code and the report delivery. See our privacy notice for what happens next."}
                </p>
              )}
            </form>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle className="serif text-[26px] leading-tight">
                Enter your code
              </DialogTitle>
              <DialogDescription className="text-bz-ink-2">
                We sent a 6-digit code to <b>{email}</b>. It expires in 10
                minutes.
              </DialogDescription>
            </DialogHeader>
            {debugCode ? (
              <div className="text-[12px] text-bz-muted rounded-md bg-bz-surface-2 p-2 mono">
                Dev mode · code: {debugCode}
              </div>
            ) : null}
            <form className="grid gap-4 mt-3" onSubmit={handleVerify}>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-code">Code</Label>
                <Input
                  id="vlg-code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="tracking-[0.5em] text-center mono text-lg"
                  required
                />
              </div>
              <Button type="submit" disabled={loading || code.length !== 6}>
                {loading ? (
                  <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} strokeWidth={1.7} />
                )}
                Verify and request report
              </Button>
              <button
                type="button"
                className="text-[12.5px] text-bz-muted hover:text-bz-ink underline underline-offset-2"
                onClick={() => setStep("form")}
              >
                ← Use a different email
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-bz-accent/15 text-bz-accent flex items-center justify-center mx-auto mb-3">
                <Check size={22} strokeWidth={1.8} />
              </div>
              <DialogTitle className="serif text-[26px] text-center leading-tight">
                Report on its way
              </DialogTitle>
              <DialogDescription className="text-bz-ink-2 text-center">
                A Bazar advisor will review your figures and send the full
                report to <b>{email}</b> within 24 hours.
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setOpen(false)} className="mt-4">
              Close
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
