"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishDevelopment, unpublishDevelopment } from "./_actions";

export function PublishCard({
  developmentId,
  publishedAt,
}: {
  developmentId: string;
  publishedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<string | null>(publishedAt);
  const isPublished = current !== null;

  function publish() {
    startTransition(async () => {
      const r = await publishDevelopment(developmentId);
      if (r.status === "ok") {
        setCurrent(new Date().toISOString());
        toast.success("Published.");
      } else {
        toast.error(r.message);
      }
    });
  }

  function unpublish() {
    startTransition(async () => {
      const r = await unpublishDevelopment(developmentId);
      if (r.status === "ok") {
        setCurrent(null);
        toast.success("Unpublished.");
      } else {
        toast.error(r.message);
      }
    });
  }

  return (
    <div className="border border-bz-border rounded-lg bg-bz-surface p-5">
      <div className="text-[11px] uppercase tracking-wider text-bz-muted">
        Publish
      </div>
      <div className="mt-2.5 text-[14px]">
        {isPublished ? (
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-bz-success" />
            Live since{" "}
            {new Date(current!).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-bz-muted" />
            Not published
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-bz-muted mt-2 leading-[1.5]">
        Publishing makes the development visible at{" "}
        <span className="mono">/developments/{"<slug>"}</span> and on the
        developments index.
      </p>
      <div className="mt-4">
        {isPublished ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={unpublish}
            className="w-full"
          >
            {pending ? "…" : "Unpublish"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={publish}
            className="w-full"
          >
            {pending ? "…" : "Publish"}
          </Button>
        )}
      </div>
    </div>
  );
}
