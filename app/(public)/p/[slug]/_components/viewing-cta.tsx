"use client";

/**
 * T2-C: Dual CTA — video tour OR live viewing.  Wraps the existing
 * `<ScheduleViewing>` component (which handles live in-person viewings)
 * with a second pill that opens a modal collecting a recorded-walkthrough
 * request.  The request flows through `/api/valuation-lead` with
 * `intent: 'other'` for v1; spec'd separately when conversion telemetry
 * needs to distinguish.
 */

import { useState } from "react";
import { Calendar, Loader2, Mail, Play, Video } from "lucide-react";
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
import { Eyebrow } from "@/components/brand/eyebrow";

type Props = {
  propertyReference: string;
  propertyTitle: string;
  /**
   * When a hosted video URL is available (YouTube, Vimeo, Mux), the modal
   * embeds it directly. Otherwise the modal asks for an email so an advisor
   * can record + send a private walkthrough.
   */
  videoEmbedUrl?: string | null;
};

export function ViewingCta({
  propertyReference,
  propertyTitle,
  videoEmbedUrl,
}: Props) {
  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5">
      <Eyebrow>See it for yourself</Eyebrow>
      <h4 className="serif text-[18px] mt-2 leading-tight mb-4">
        Live viewing or a recorded tour?
      </h4>
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="default" size="sm">
          <a href="#schedule-viewing">
            <Calendar size={13} strokeWidth={1.7} />
            Live viewing
          </a>
        </Button>
        <VideoTourDialog
          propertyReference={propertyReference}
          propertyTitle={propertyTitle}
          videoEmbedUrl={videoEmbedUrl}
        />
      </div>
      <p className="mt-3 text-[11.5px] text-bz-ink-2">
        Outside the UAE? Ask for a recorded walkthrough — your advisor narrates
        what you can&apos;t see in photos.
      </p>
    </div>
  );
}

function VideoTourDialog({
  propertyReference,
  propertyTitle,
  videoEmbedUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
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
          intent: "other",
          property_summary: `Recorded walkthrough · ${propertyReference} · ${propertyTitle}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not send the request.");
        return;
      }
      setDone(true);
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
          setEmail("");
          setDone(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Video size={13} strokeWidth={1.7} />
          Video tour
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        {videoEmbedUrl ? (
          <>
            <DialogHeader>
              <DialogTitle className="serif text-[24px] leading-tight">
                {propertyTitle} · walkthrough
              </DialogTitle>
              <DialogDescription>
                Pre-recorded by the listing advisor.
              </DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full rounded-md overflow-hidden bg-bz-ink mt-2">
              <iframe
                src={videoEmbedUrl}
                title={`${propertyTitle} walkthrough`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <Button asChild variant="link" className="mt-2 self-start">
              <a href={videoEmbedUrl} target="_blank" rel="noopener noreferrer">
                <Play size={12} strokeWidth={1.8} /> Open in new tab
              </a>
            </Button>
          </>
        ) : !done ? (
          <>
            <DialogHeader>
              <DialogTitle className="serif text-[24px] leading-tight">
                Request a recorded walkthrough
              </DialogTitle>
              <DialogDescription>
                Your Bazar advisor walks through the property on camera with
                live narration and answers — usually delivered within 48
                hours. Useful when you&apos;re outside the UAE or can&apos;t
                make a live slot.
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4 mt-3" onSubmit={handleSubmit}>
              <div className="grid gap-1.5">
                <Label htmlFor="vc-email">Email</Label>
                <Input
                  id="vc-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Mail size={14} strokeWidth={1.7} />
                )}
                Request the walkthrough
              </Button>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="w-12 h-12 rounded-full bg-bz-accent/15 text-bz-accent flex items-center justify-center mx-auto mb-3">
                <Video size={20} strokeWidth={1.8} />
              </div>
              <DialogTitle className="serif text-[24px] text-center leading-tight">
                Walkthrough on its way
              </DialogTitle>
              <DialogDescription className="text-center">
                The advisor for <b>{propertyReference}</b> will record + send
                to <b>{email}</b> within 48 hours.
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
