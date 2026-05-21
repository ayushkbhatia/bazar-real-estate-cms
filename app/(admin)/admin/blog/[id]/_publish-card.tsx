"use client";

import { useTransition } from "react";
import { CheckCircle2, RefreshCw, Archive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  archiveArticle,
  publishArticle,
  unpublishArticle,
} from "./_actions";
import type { ArticleStatus } from "@/lib/queries/articles";

export type PublishCardProps = {
  articleId: string;
  status: ArticleStatus;
  updatedAt: string;
  publishedAt: string | null;
  authorName: string | null;
  publicHref: string;
};

const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

const STATUS_STYLE: Record<ArticleStatus, string> = {
  draft: "bg-bz-surface-2 text-bz-ink-2",
  scheduled: "bg-[oklch(0.96_0.05_80)] text-[oklch(0.45_0.1_60)]",
  published: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  archived: "bg-bz-surface-3 text-bz-muted",
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

export function ArticlePublishCard({
  articleId,
  status,
  updatedAt,
  publishedAt,
  authorName,
  publicHref,
}: PublishCardProps) {
  const [pending, startTransition] = useTransition();

  function runAction(
    fn: () => Promise<{ status: "ok" | "error"; message?: string }>,
  ) {
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
        <div className="flex justify-between">
          <dt className="text-bz-muted">Author</dt>
          <dd>{authorName ?? "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          form="article-edit-form"
          variant="outline"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save draft"}
        </Button>

        {status === "published" ? (
          <>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => runAction(() => unpublishArticle(articleId))}
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
              View on /insights ↗
            </a>
          </>
        ) : (
          <Button
            disabled={pending}
            onClick={() => runAction(() => publishArticle(articleId))}
          >
            <CheckCircle2 size={14} strokeWidth={1.8} />
            Publish
          </Button>
        )}

        {status !== "archived" ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => runAction(() => archiveArticle(articleId))}
            className="justify-center"
          >
            <Archive size={14} strokeWidth={1.8} />
            Archive
          </Button>
        ) : null}
      </div>
    </div>
  );
}
