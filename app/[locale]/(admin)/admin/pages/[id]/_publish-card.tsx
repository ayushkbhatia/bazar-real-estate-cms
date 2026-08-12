"use client";

import { useTransition } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PageStatus } from "@/lib/schemas/page";
import { publishPage, unpublishPage } from "./_actions";

type Props = {
  pageId: string;
  status: PageStatus;
  updatedAt: string;
  publishedAt: string | null;
  publicHref: string;
};

const STATUS_LABEL: Record<PageStatus, string> = {
  draft: "Draft",
  published: "Published",
};

const STATUS_STYLE: Record<PageStatus, string> = {
  draft: "bg-bz-surface-2 text-bz-ink-2",
  published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PagePublishCard({
  pageId,
  status,
  updatedAt,
  publishedAt,
  publicHref,
}: Props) {
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ status: "ok" | "error"; message?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.status === "ok") toast.success(result.message ?? "Saved.");
      else toast.error(result.message ?? "Something went wrong.");
    });
  }

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5 flex flex-col gap-4">
      <div className="text-[11px] uppercase tracking-widest text-bz-muted-2">
        Publish
      </div>
      <dl className="text-[12.5px] flex flex-col gap-2">
        <div className="flex justify-between">
          <dt className="text-bz-muted">Status</dt>
          <dd>
            <span
              className={cn(
                "inline-flex items-center h-[20px] px-2 rounded-full text-[10.5px] font-medium",
                STATUS_STYLE[status],
              )}
            >
              {STATUS_LABEL[status]}
            </span>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-bz-muted">Last edited</dt>
          <dd>{fmt(updatedAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-bz-muted">Published</dt>
          <dd>{publishedAt ? fmt(publishedAt) : "—"}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          form="page-meta-form"
          variant="outline"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save meta"}
        </Button>
        {status === "published" ? (
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => unpublishPage(pageId))}
            >
              <RefreshCw size={14} strokeWidth={1.8} />
              Revert to draft
            </Button>
            <a
              href={publicHref}
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-bz-muted hover:text-bz-ink text-center"
            >
              View on site ↗
            </a>
          </>
        ) : (
          <Button
            disabled={pending}
            onClick={() => run(() => publishPage(pageId))}
          >
            <CheckCircle2 size={14} strokeWidth={1.8} />
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}
