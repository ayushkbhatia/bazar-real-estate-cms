"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishDevelopment, unpublishDevelopment } from "./[id]/_actions";

/**
 * Publish / unpublish a development.
 *
 * Rendered in two places on purpose: the project record and the project page
 * editor. Publishing used to live only on the record, which meant the page
 * editor — the screen that owns the four hero facts the publish gate actually
 * checks — could only tell you to go somewhere else to finish the job. Both
 * call the same server action, so there is one behaviour and one audit trail;
 * only the door differs.
 *
 * `checks` is the gate evaluated server-side. When it fails the button is
 * disabled and the outstanding items are named, so "why can't I publish this"
 * is answered here rather than by a toast after the fact.
 */

export type PublishCheck = { label: string; passed: boolean };

export function PublishCard({
  developmentId,
  publishedAt,
  slug,
  checks,
  canPublish = true,
  /** Where to send someone whose draft is missing facts this screen can't edit. */
  fixHref,
}: {
  developmentId: string;
  publishedAt: string | null;
  slug?: string;
  checks?: PublishCheck[];
  canPublish?: boolean;
  fixHref?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useState<string | null>(publishedAt);
  const isPublished = current !== null;

  const outstanding = (checks ?? []).filter((c) => !c.passed);
  const blocked = outstanding.length > 0;

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
        toast.success("Unpublished — the page is a draft again.");
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
            Draft — not on the public site
          </span>
        )}
      </div>

      <p className="text-[11.5px] text-bz-muted mt-2 leading-[1.5]">
        {isPublished ? (
          <>
            Live at{" "}
            <span className="mono">/developments/{slug ?? "<slug>"}</span> and
            on the developments index.
          </>
        ) : (
          <>
            Your work is saved as you go. Publishing puts the project on the
            public site at{" "}
            <span className="mono">/developments/{slug ?? "<slug>"}</span>.
          </>
        )}
      </p>

      {/*
        Only worth showing while there is something to fix — a complete draft
        doesn't need a wall of ticks, and a live project has already passed.
      */}
      {!isPublished && blocked ? (
        <div className="mt-3.5 rounded border border-bz-border bg-bz-surface-2 p-3">
          <div className="text-[11.5px] font-medium">
            {outstanding.length === 1
              ? "One thing left before this can go live"
              : `${outstanding.length} things left before this can go live`}
          </div>
          <ul className="mt-2 flex flex-col gap-1.5">
            {(checks ?? []).map((c) => (
              <li
                key={c.label}
                className="flex items-center gap-2 text-[11.5px] text-bz-ink-2"
              >
                {c.passed ? (
                  <Check size={12} strokeWidth={2} className="text-bz-success" />
                ) : (
                  <X size={12} strokeWidth={2} className="text-bz-muted-2" />
                )}
                <span className={c.passed ? "text-bz-muted" : undefined}>
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
          {fixHref ? (
            <Link
              href={fixHref}
              className="mt-2.5 inline-block text-[11.5px] underline underline-offset-2 hover:text-bz-ink"
            >
              Add the key facts
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4">
        {isPublished ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !canPublish}
            onClick={unpublish}
            className="w-full"
          >
            {pending ? "…" : "Unpublish"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={pending || blocked || !canPublish}
            onClick={publish}
            className="w-full"
          >
            {pending ? "…" : "Publish"}
          </Button>
        )}
        {canPublish ? null : (
          <p className="mt-2 text-[11.5px] text-bz-muted">
            Your role can edit this project but not publish it — an admin or
            editor can take it live.
          </p>
        )}
      </div>
    </div>
  );
}
