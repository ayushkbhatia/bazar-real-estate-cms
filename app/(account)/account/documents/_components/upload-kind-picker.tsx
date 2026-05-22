"use client";

import { useState } from "react";
import { Upload, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const KINDS = {
  kyc: [
    { code: "passport", label: "Passport" },
    { code: "emirates_id", label: "Emirates ID" },
    { code: "proof_of_address", label: "Proof of address" },
    { code: "selfie", label: "Liveness selfie" },
  ],
  deal: [
    { code: "mou", label: "MoU / Form F" },
    { code: "noc", label: "Developer NOC" },
    { code: "title_deed", label: "Title deed" },
    { code: "transfer_receipt", label: "DLD transfer receipt" },
    { code: "mortgage_pre_approval", label: "Mortgage pre-approval" },
  ],
  other: [
    { code: "bank_statement", label: "Bank statement" },
    { code: "references", label: "References" },
    { code: "misc", label: "Other" },
  ],
} as const;

/**
 * Sprint 6 (backfilled): upload-kind picker for /account/documents.
 * Replaces the single "Upload KYC" button with a per-kind selector so
 * users can upload offer/deal documents too (the original page only
 * accepted KYC kinds).
 */
export function UploadKindPicker({
  onPick,
}: {
  onPick?: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);

  function handle(code: string) {
    setOpen(false);
    if (onPick) onPick(code);
    else
      toast.info(
        `Upload to ${code.replace(/_/g, " ")} activates with Sprint 9 storage wiring.`,
      );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-bz-ink text-bz-bg text-[13px] font-medium hover:bg-bz-ink-2 transition-colors"
        >
          <Upload size={13} strokeWidth={1.7} />
          Upload document
          <ChevronDown size={13} strokeWidth={1.7} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Identity & KYC</DropdownMenuLabel>
        {KINDS.kyc.map((k) => (
          <DropdownMenuItem key={k.code} onSelect={() => handle(k.code)}>
            {k.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Offer & deal</DropdownMenuLabel>
        {KINDS.deal.map((k) => (
          <DropdownMenuItem key={k.code} onSelect={() => handle(k.code)}>
            {k.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Other</DropdownMenuLabel>
        {KINDS.other.map((k) => (
          <DropdownMenuItem key={k.code} onSelect={() => handle(k.code)}>
            {k.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
