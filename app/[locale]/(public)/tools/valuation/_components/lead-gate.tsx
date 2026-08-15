"use client";

/**
 * T1-E: Lead-gate modal that sits on the valuation page. The user sees their
 * instant estimate first (the dopamine hit). Clicking "Get the full advisor
 * report" opens this modal, which collects email + optional phone + intent,
 * sends an OTP, and on verify enqueues the lead + emails the prepared
 * report follow-up.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  /**
   * Override label for the trigger button.
   *
   * A caller passing this owns the string — `/tools/valuation` says "Skip to
   * advisor-prepared report" from its own namespace. Left unset, the gate uses
   * `forms.gate.trigger`; the old default was a literal here, which no caller
   * could translate and no extraction pass could see.
   */
  triggerLabel?: string;
};

type Step = "form" | "verify" | "done";

export function ValuationLeadGate({
  form,
  valuationAed,
  propertySummary,
  triggerLabel,
}: Props) {
  /*
   * `forms`, not `tools` — this file sits under `tools/valuation/` and renders
   * on `/areas/[slug]`, `/p/[slug]`, the developments floor-plan gate and the
   * shared CTA banner, none of which mount the route-scoped `tools` bag. A
   * route-scoped namespace is scoped by the URL, not by the folder.
   */
  const t = useTranslations("forms");
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
        toast.error(data.error ?? t("gate.codeFailed"));
        return;
      }
      // Dev-only echo so we can hand-test without Resend.
      if (data.debug_code) setDebugCode(data.debug_code);
      setStep("verify");
      toast.success(t("gate.codeSent"));
    } catch {
      toast.error(t("gate.networkError"));
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
        toast.error(data.error ?? t("gate.verifyFailed"));
        return;
      }
      setStep("done");
    } catch {
      toast.error(t("gate.networkError"));
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
        <Button size="lg">{triggerLabel ?? t("gate.trigger")}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="serif text-[26px] leading-tight">
                {form?.copy.title ?? t("gate.title")}
              </DialogTitle>
              <DialogDescription className="text-bz-ink-2">
                {form?.copy.subtitle ?? t("gate.subtitle")}
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4 mt-3" onSubmit={handleIssue}>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-email">{t("gate.email")}</Label>
                <Input
                  id="vlg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("gate.emailPlaceholder")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-name">{t("gate.name")}</Label>
                <Input
                  id="vlg-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder={t("gate.namePlaceholder")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-phone">{t("gate.phone")}</Label>
                <Input
                  id="vlg-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder={t("gate.phonePlaceholder")}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-intent">{t("gate.intent")}</Label>
                <select
                  id="vlg-intent"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={intent}
                  onChange={(e) =>
                    setIntent(e.target.value as typeof intent)
                  }
                >
                  {/* The value is the identity the API validates; only the
                      label moves. */}
                  <option value="curious">{t("gate.intentCurious")}</option>
                  <option value="sell">{t("gate.intentSell")}</option>
                  <option value="refinance">{t("gate.intentRefinance")}</option>
                  <option value="other">{t("gate.intentOther")}</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="mt-2">
                {loading ? (
                  <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Mail size={14} strokeWidth={1.7} />
                )}
                {loading
                  ? (form?.copy.pending_label ?? t("gate.sending"))
                  : (form?.copy.submit_label ?? t("gate.submit"))}
              </Button>
              {form?.copy.consent_note === null ? null : (
                <p className="text-[11.5px] text-bz-muted">
                  {form?.copy.consent_note ?? t("gate.consent")}
                </p>
              )}
            </form>
          </>
        )}

        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle className="serif text-[26px] leading-tight">
                {t("gate.verifyTitle")}
              </DialogTitle>
              <DialogDescription className="text-bz-ink-2">
                {t("gate.verifySubtitle", { email })}
              </DialogDescription>
            </DialogHeader>
            {debugCode ? (
              <div className="text-[12px] text-bz-muted rounded-md bg-bz-surface-2 p-2 mono">
                {t("gate.devCode", { code: debugCode })}
              </div>
            ) : null}
            <form className="grid gap-4 mt-3" onSubmit={handleVerify}>
              <div className="grid gap-1.5">
                <Label htmlFor="vlg-code">{t("gate.code")}</Label>
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
                {t("gate.verifySubmit")}
              </Button>
              <button
                type="button"
                className="text-[12.5px] text-bz-muted hover:text-bz-ink underline underline-offset-2"
                onClick={() => setStep("form")}
              >
                {t("gate.differentEmail")}
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
                {t("gate.doneTitle")}
              </DialogTitle>
              <DialogDescription className="text-bz-ink-2 text-center">
                {t("gate.doneBody", { email })}
              </DialogDescription>
            </DialogHeader>
            <Button onClick={() => setOpen(false)} className="mt-4">
              {t("gate.close")}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
