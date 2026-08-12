"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublishCheck } from "@/lib/page-builder/publishability";
import { publishLandingPage, unpublishLandingPage } from "../_actions";

/**
 * Publish, with the gate's own check list above the button.
 *
 * The list is `evaluateLandingPublishability`'s `checks`, computed on the
 * server against the stored draft — the same call the action makes. One
 * function, so the button and the server can't disagree about whether the page
 * is ready.
 */
export function LandingPublishCard({
  id,
  slug,
  status,
  hasDraft,
  publishedAt,
  checks,
  ok,
  blockers,
}: {
  id: string;
  slug: string;
  status: "draft" | "published";
  hasDraft: boolean;
  publishedAt: string | null;
  checks: PublishCheck[];
  ok: boolean;
  blockers: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState<string[]>([]);

  function onPublish() {
    setShown([]);
    startTransition(async () => {
      const result = await publishLandingPage(id);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else if (result.status === "blocked") {
        setShown(result.blockers);
        toast.error(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  function onUnpublish() {
    if (
      !confirm(
        `Take /lp/${slug} offline? Anyone following an advert to it will get a 404.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await unpublishLandingPage(id);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  const live = status === "published";
  const problems = shown.length > 0 ? shown : ok ? [] : blockers;

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
      <div>
        <h2 className="text-[13.5px] font-medium">
          {live ? "Live" : "Not published"}
        </h2>
        <p className="text-[11.5px] text-bz-muted">
          {live
            ? hasDraft
              ? `Published${publishedAt ? ` ${new Date(publishedAt).toLocaleDateString("en-GB")}` : ""} — with unpublished changes waiting.`
              : `Published${publishedAt ? ` ${new Date(publishedAt).toLocaleDateString("en-GB")}` : ""}. The draft and the live page match.`
            : "Nothing at /lp/" + slug + " until you publish."}
        </p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {checks.map((check) => (
          <li
            key={check.label}
            className="flex items-start gap-2 text-[12px] leading-[1.45]"
          >
            <span
              className={cn(
                "mt-[1px] inline-flex h-4 w-4 items-center justify-center rounded-full shrink-0",
                check.passed
                  ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                  : "bg-bz-surface-2 text-bz-muted",
              )}
            >
              {check.passed ? (
                <Check size={10} strokeWidth={2.4} />
              ) : (
                <Minus size={10} strokeWidth={2.4} />
              )}
            </span>
            <span className={check.passed ? "text-bz-ink-2" : "text-bz-muted"}>
              {check.label}
            </span>
          </li>
        ))}
      </ul>

      {problems.length > 0 ? (
        <ul className="rounded border border-[oklch(0.85_0.09_28)] bg-[oklch(0.97_0.02_28)] px-3 py-2.5 flex flex-col gap-1">
          {problems.map((blocker) => (
            <li
              key={blocker}
              className="text-[11.5px] text-[oklch(0.42_0.13_28)] flex items-start gap-1.5"
            >
              <X size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
              {blocker}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          onClick={onPublish}
          disabled={pending || (live && !hasDraft)}
        >
          <Globe size={13} strokeWidth={1.8} />
          {pending
            ? "Publishing…"
            : live
              ? "Publish changes"
              : "Publish"}
        </Button>
        {live ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onUnpublish}
            disabled={pending}
          >
            Unpublish
          </Button>
        ) : null}
        {live && !hasDraft ? (
          <span className="text-[11.5px] text-bz-muted">
            Nothing to publish — the draft matches what&apos;s live.
          </span>
        ) : null}
      </div>
    </section>
  );
}
