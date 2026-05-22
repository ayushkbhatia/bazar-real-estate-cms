"use client";

import { useState, useTransition } from "react";
import { Download, Mail } from "lucide-react";
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

/**
 * Sprint 5a: email-gated brochure download for development pages.
 *
 * For Sprint 5a the form just collects the email + toasts success.
 * Sprint 10's enquiry workflow will route this through the lead engine
 * so the brochure is emailed with tracking + the user lands in the inbox.
 */
export function BrochureGate({
  developmentName,
}: {
  developmentName: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Email is required.");
      return;
    }
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, 500));
      toast.success(
        `Brochure on its way to ${email}. Sprint 10 wires the real send.`,
      );
      setOpen(false);
      setEmail("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Download size={14} strokeWidth={1.7} />
          Download brochure
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Get the {developmentName} brochure</DialogTitle>
          <DialogDescription>
            We&apos;ll email you the full PDF and follow up with a short note
            from the lead advisor — no spam, no portal partners.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4 px-6 py-2">
          <div>
            <Label htmlFor="brochure-email">Email</Label>
            <div className="relative mt-1.5">
              <Mail
                size={14}
                strokeWidth={1.7}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
              />
              <Input
                id="brochure-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Email me the brochure"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
