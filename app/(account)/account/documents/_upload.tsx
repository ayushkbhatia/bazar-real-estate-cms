"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_KIND_LABELS,
  type DocumentKind,
} from "@/lib/deals";
import { startAccountDocumentUpload } from "./_actions";

const KINDS: DocumentKind[] = [
  "passport",
  "emirates_id",
  "mortgage_pre_approval",
];

export function AccountDocumentUpload({
  defaultKind,
}: {
  defaultKind?: DocumentKind;
}) {
  const [kind, setKind] = useState<DocumentKind>(defaultKind ?? "passport");
  const [uploading, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    start(async () => {
      const init = await startAccountDocumentUpload({
        kind,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });
      if (init.status === "error") {
        toast.error(init.message);
        return;
      }
      try {
        const r = await fetch(init.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });
        if (!r.ok) {
          toast.error(`Upload failed (${r.status}).`);
          return;
        }
        toast.success(`${DOCUMENT_KIND_LABELS[kind]} uploaded.`);
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as DocumentKind)}>
          <SelectTrigger className="w-[220px] h-9 text-[13.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {DOCUMENT_KIND_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="default"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={14} strokeWidth={1.8} />
          {uploading ? "Uploading…" : "Upload document"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
      </div>
      <p className="mt-3 text-[12px] text-bz-muted leading-relaxed">
        PDF or photo. We accept Emirates ID and passport from both sides.
        Documents stay private — only your advisor can see them, and only
        after you upload.
      </p>
    </div>
  );
}
