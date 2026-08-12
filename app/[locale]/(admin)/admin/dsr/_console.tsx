"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Search, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow } from "@/components/brand/eyebrow";
import type { fulfilExportRequest, fulfilErasureRequest } from "./_actions";

/**
 * Fulfilment console for a data-subject request that arrived by email.
 *
 * Two deliberate choices:
 *  · Export and erasure are separate buttons with separate confirmations.
 *    Erasure is irreversible and must never be one mis-click away from an
 *    access request.
 *  · The archive downloads from the browser rather than being emailed. The
 *    staff member has already verified the subject's identity over email and
 *    replies there themselves — auto-mailing personal data to an address typed
 *    into a form is exactly how a DSR becomes a breach.
 */
export function DsrConsole({
  runExport,
  runErasure,
}: {
  // Passed by reference from the server page — an arrow wrapper here would be
  // a plain function and could not cross the server/client boundary.
  runExport: typeof fulfilExportRequest;
  runErasure: typeof fulfilErasureRequest;
}) {
  const [email, setEmail] = useState("");
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"export" | "erase" | null>(null);
  const [lastDetail, setLastDetail] = useState<string | null>(null);

  function onExport() {
    if (!email.includes("@")) {
      toast.error("Enter the subject's email address.");
      return;
    }
    setBusy("export");
    setLastDetail(null);
    start(async () => {
      const result = await runExport(email);
      setBusy(null);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      // Hand the archive straight to the browser; nothing is stored.
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(result.message);
    });
  }

  function onErase() {
    if (!email.includes("@")) {
      toast.error("Enter the subject's email address.");
      return;
    }
    if (
      !confirm(
        `Erase every personal-data field held for ${email}?\n\nThis cannot be undone. Enquiries, valuations and mortgage enquiries are kept with their personal fields wiped (7-year AML duty); the newsletter subscription is deleted outright.\n\nOnly do this once you have verified the requester's identity.`,
      )
    )
      return;
    setBusy("erase");
    setLastDetail(null);
    start(async () => {
      const result = await runErasure(email);
      setBusy(null);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setLastDetail(result.detail ?? null);
    });
  }

  return (
    <div className="flex flex-col gap-5 max-w-[640px]">
      <div className="rounded-lg border border-bz-border bg-bz-surface p-5">
        <Eyebrow>Data subject</Eyebrow>
        <div className="mt-3 flex flex-col gap-1.5">
          <Label htmlFor="dsr-email">Email address</Label>
          <Input
            id="dsr-email"
            type="email"
            placeholder="them@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <p className="text-[11.5px] text-bz-muted">
            The address the request came from. Everything Bazar holds is keyed
            to it — enquiries and their message threads, valuation requests,
            mortgage enquiries, and the newsletter list.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onExport} disabled={pending}>
            {busy === "export" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Building…
              </>
            ) : (
              <>
                <Download size={14} strokeWidth={1.7} />
                Build access archive
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onErase}
            disabled={pending}
            className="text-[oklch(0.45_0.13_28)] hover:bg-[oklch(0.95_0.05_28)]"
          >
            {busy === "erase" ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Erasing…
              </>
            ) : (
              <>
                <ShieldAlert size={14} strokeWidth={1.7} />
                Erase all data
              </>
            )}
          </Button>
        </div>

        {lastDetail ? (
          <p className="mt-4 text-[12.5px] text-bz-ink-2">
            <span className="text-bz-muted">Scrubbed — </span>
            {lastDetail}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-5 text-[12.5px] leading-relaxed text-bz-ink-2">
        <div className="inline-flex items-center gap-1.5 font-medium text-bz-ink">
          <Search size={13} strokeWidth={1.8} />
          Before you act
        </div>
        <ul className="mt-2 list-disc ps-4 flex flex-col gap-1.5">
          <li>
            Verify the requester actually controls the address — reply to it and
            get a confirmation before erasing anything.
          </li>
          <li>
            The archive downloads to your machine. Send it from the DPO mailbox
            yourself; nothing is emailed automatically.
          </li>
          <li>
            Erasure keeps AML-relevant rows and wipes their personal fields, so
            transaction history can still be reconstructed for seven years.
            KYC documents tied to a closed deal are out of scope and need a
            separate review.
          </li>
          <li>
            Both actions are recorded in <span className="mono">dsr_requests</span>{" "}
            and the audit log — that record is the evidence the request was
            handled.
          </li>
        </ul>
      </div>
    </div>
  );
}
