"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CardKey, CardOverride } from "@/lib/master-pages/cards";
import { releaseMatchingOverrides } from "../_actions";

export type OverrideRow = {
  slug: string;
  name: string;
  published: boolean;
  overrides: CardOverride[];
};

/**
 * Which projects override the card, field by field, and whether each
 * override is the card's own wording typed out again or wording of its own.
 *
 * The distinction is the whole point. An override that matches is invisible
 * today and a trap tomorrow: the page reads correctly, so nobody looks, and
 * the next edit to the card silently skips that project. One that differs is
 * a decision somebody made, and is only ever changed on that project's page.
 */
export function OverridesPanel({
  cardKey,
  rows,
  total,
}: {
  cardKey: CardKey;
  rows: OverrideRow[];
  /** Every project, overriding or not — the denominator. */
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const matching = rows.reduce(
    (n, r) => n + r.overrides.filter((o) => o.matchesCard).length,
    0,
  );
  const matchingProjects = rows.filter((r) =>
    r.overrides.some((o) => o.matchesCard),
  ).length;

  function onRelease() {
    if (
      !confirm(
        `Clear ${matching} override${matching === 1 ? "" : "s"} on ${matchingProjects} project${matchingProjects === 1 ? "" : "s"} that repeat the card word for word?\n\nNothing changes on the English pages. From then on, editing the card changes these projects too. Overrides with their own wording are left alone.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await releaseMatchingOverrides(cardKey);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface">
      <div className="flex flex-wrap items-center gap-3 border-b border-bz-border px-4 py-3">
        <div className="me-auto">
          <h2 className="text-[13.5px] font-medium">
            Projects with their own wording
          </h2>
          <p className="text-[11.5px] text-bz-muted max-w-[70ch]">
            A project&apos;s own wording beats the card, so an edit here does
            not reach the fields listed below.{" "}
            {total === 0
              ? "No projects yet."
              : rows.length === 0
                ? `None of the ${total} projects overrides this card — every edit here reaches all of them.`
                : `${rows.length} of ${total} projects override at least one field.`}
          </p>
        </div>
        {matching > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRelease}
            disabled={pending}
          >
            <Undo2 size={13} strokeWidth={1.8} />
            {pending
              ? "Handing back…"
              : `Hand ${matching} matching back to the card`}
          </Button>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <ul className="divide-y divide-bz-border">
          {rows.map((row) => (
            <li
              key={row.slug}
              className="flex flex-wrap items-start gap-3 px-4 py-3"
            >
              <div className="w-[220px] shrink-0">
                <div className="text-[13px] font-medium">{row.name}</div>
                <div className="mono text-[11px] text-bz-muted">
                  /developments/{row.slug}
                  {row.published ? "" : " · draft"}
                </div>
              </div>
              <ul className="flex flex-1 flex-wrap gap-1.5">
                {row.overrides.map((o) => (
                  <li
                    key={o.field}
                    title={[
                      o.en ? `EN: ${o.en}` : "EN: (card's)",
                      o.ar ? `AR: ${o.ar}` : "AR: (card's)",
                    ].join("\n")}
                    className={cn(
                      "inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-[11px]",
                      o.matchesCard
                        ? "bg-bz-surface-2 text-bz-ink-2"
                        : "bg-[oklch(0.95_0.05_75)] text-[oklch(0.42_0.1_60)]",
                    )}
                  >
                    {o.label}
                    <span className="opacity-70">
                      · {o.matchesCard ? "same as card" : "own wording"}
                      {o.arabicMissing ? " · no Arabic" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={`/admin/pages/sub/development/${row.slug}`}
                className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink"
              >
                Edit project page <ExternalLink size={11} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
