"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishMegamenuTab, unpublishMegamenuTab } from "./_actions";

type Props = {
  tabId: string;
  status: "draft" | "published";
  hasPanel: boolean;
};

export function MegamenuPublishCard({ tabId, status, hasPanel }: Props) {
  const [pending, startTransition] = useTransition();
  const isPublished = status === "published";

  function onTogglePublish() {
    startTransition(async () => {
      const action = isPublished ? unpublishMegamenuTab : publishMegamenuTab;
      const res = await action(tabId);
      if (res.status === "ok") toast.success(res.message);
      else toast.error(res.message);
    });
  }

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3
          className="serif text-[18px]"
          style={{ letterSpacing: "-0.015em" }}
        >
          Status
        </h3>
        <span
          className={`text-[11px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
            isPublished
              ? "bg-bz-success/10 text-bz-success"
              : "bg-bz-warning/15 text-bz-warning"
          }`}
        >
          {isPublished ? "Published" : "Draft"}
        </span>
      </div>

      <p className="text-[12.5px] text-bz-muted">
        {isPublished
          ? "This tab is live in the public-site megamenu."
          : hasPanel
            ? "Add at least one column, then publish to make it live."
            : "Set a direct-link href, then publish to make it live."}
      </p>

      <Button onClick={onTogglePublish} disabled={pending} size="sm">
        {pending
          ? isPublished
            ? "Unpublishing…"
            : "Publishing…"
          : isPublished
            ? "Unpublish"
            : "Publish"}
      </Button>
    </div>
  );
}
