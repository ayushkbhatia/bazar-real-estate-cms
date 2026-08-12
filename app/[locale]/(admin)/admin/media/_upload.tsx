"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_BYTES, megabytes, type UploadFolder } from "@/lib/media";
import { uploadToLibrary } from "./_upload-client";

type Props = {
  folder?: UploadFolder;
};

export function MediaUploader({ folder = "listings" }: Props) {
  const [pending, startTransition] = useTransition();
  const [filename, setFilename] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function onChoose() {
    inputRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    startTransition(async () => {
      const result = await uploadToLibrary(file, { folder });
      if (result.status === "ok") {
        toast.success(`Uploaded ${file.name}`);
        setFilename(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        toast.error(result.message);
        setFilename(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={onFile}
        disabled={pending}
      />
      <Button type="button" onClick={onChoose} disabled={pending}>
        <Upload size={14} strokeWidth={1.8} />
        {pending ? `Uploading ${filename ?? "…"}…` : "Upload media"}
      </Button>
      <span className="text-[12px] text-bz-muted">
        Folder: <span className="mono">{folder}</span> · max{" "}
        {megabytes(MAX_UPLOAD_BYTES)} MB
      </span>
    </div>
  );
}
