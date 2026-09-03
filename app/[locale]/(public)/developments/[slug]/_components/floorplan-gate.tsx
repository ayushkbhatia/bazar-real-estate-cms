"use client";

/**
 * T2-B: Floor plan "Layout on Request" gate.
 *
 * When `development.meta.floorplan_gated === true`, each floor-plan card on
 * the development detail page blurs the image and overlays a "Request
 * layout" CTA.  Clicking opens a modal that collects email + intent and
 * (Sprint 10 wiring) emails a signed one-time PDF URL.
 *
 * For v1 the request is a thin wrapper around the existing valuation
 * lead-gate endpoint (`/api/valuation-lead` already handles OTP + enquiry
 * enqueue); we send `purpose: 'floorplan'` so the advisor inbox knows
 * what to ship.  Stand-alone endpoint can come later if we need separate
 * conversion telemetry.
 */

import { useState } from "react";
import Image from "next/image";
import { FileText, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { formatArea, usePreferences } from "@/lib/preferences";

type Props = {
  developmentName: string;
  developmentSlug: string;
  /** Floor-plan record from `listFloorPlans()`. */
  plan: {
    id: string;
    label: string;
    area_ft2: number | null;
    media: {
      storage_key: string;
      filename: string;
      alt_text: string | null;
    } | null;
  };
};

export function FloorplanGate({ developmentName, developmentSlug, plan }: Props) {
  const { prefs } = usePreferences();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
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
          name: name || undefined,
          intent: "other",
          property_summary: `Floor plan request · ${developmentName} · ${plan.label}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not send the floor plan.");
        return;
      }
      setDone(true);
      toast.success("Sent — check your inbox.");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-4">
      <div className="relative aspect-square rounded overflow-hidden">
        {plan.media ? (
          <Image
            src={mediaPublicUrl(plan.media.storage_key)}
            alt={plan.media.alt_text ?? plan.label}
            fill
            sizes="33vw"
            className="object-cover rounded blur-sm scale-105"
          />
        ) : (
          <PlaceholderImage
            label={plan.label
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")}
            className="absolute inset-0 w-full h-full"
          />
        )}
        {/* Lock overlay */}
        <div className="absolute inset-0 bg-bz-bg/55 backdrop-blur-[2px] flex items-center justify-center">
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) {
                setDone(false);
                setEmail("");
                setName("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="gap-1.5">
                <Lock size={12} strokeWidth={1.8} />
                Request layout
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              {!done ? (
                <>
                  <DialogHeader>
                    <DialogTitle className="serif text-[24px] leading-tight">
                      Request the {plan.label}
                    </DialogTitle>
                    <DialogDescription>
                      Tell us where to send it. The Bazar advisor for{" "}
                      {developmentName} will email the floor-plan PDF, plus
                      any constraints buyers should know about the layout.
                    </DialogDescription>
                  </DialogHeader>
                  <form className="grid gap-4 mt-2" onSubmit={handleSubmit}>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`fpg-email-${developmentSlug}-${plan.id}`}>
                        Email
                      </Label>
                      <Input
                        id={`fpg-email-${developmentSlug}-${plan.id}`}
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`fpg-name-${developmentSlug}-${plan.id}`}>
                        Name (optional)
                      </Label>
                      <Input
                        id={`fpg-name-${developmentSlug}-${plan.id}`}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                      ) : (
                        <Mail size={14} strokeWidth={1.7} />
                      )}
                      Email me the floor plan
                    </Button>
                    <p className="text-[11px] text-bz-ink-2">
                      We use your email only to send the layout. No
                      portal partners, no spam.
                    </p>
                  </form>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <div className="w-12 h-12 rounded-full bg-bz-accent/15 text-bz-accent flex items-center justify-center mx-auto mb-3">
                      <FileText size={20} strokeWidth={1.8} />
                    </div>
                    <DialogTitle className="serif text-[24px] text-center leading-tight">
                      Floor plan on its way
                    </DialogTitle>
                    <DialogDescription className="text-center">
                      A Bazar advisor will send <b>{plan.label}</b> to{" "}
                      <b>{email}</b> within 24 hours.
                    </DialogDescription>
                  </DialogHeader>
                  <Button onClick={() => setOpen(false)} className="mt-4">
                    Close
                  </Button>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="flex justify-between items-center mt-3">
        <div>
          <div className="text-[14px] font-medium">{plan.label}</div>
          <div className="text-[11.5px] text-bz-ink-2">
            {formatArea(plan.area_ft2, prefs)}
          </div>
        </div>
      </div>
    </div>
  );
}
