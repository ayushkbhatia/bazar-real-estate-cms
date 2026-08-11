"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setDeveloperPublished } from "../_actions";

/**
 * Publish state for one developer, on its own record.
 *
 * The catalogue list already has a per-row toggle, but an operator who has
 * opened a developer to edit it shouldn't have to navigate back to a list to
 * take it off the site — the property editor puts its publish control on the
 * record for the same reason.
 */
export function DeveloperPublishCard({
  id,
  name,
  slug,
  published,
  developmentCount,
  propertyCount,
}: {
  id: string;
  name: string;
  slug: string;
  published: boolean;
  developmentCount: number;
  propertyCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onToggle() {
    if (published) {
      const attached = developmentCount + propertyCount;
      const tail =
        attached > 0
          ? ` Its ${developmentCount} project${developmentCount === 1 ? "" : "s"} and ${propertyCount} listing${propertyCount === 1 ? "" : "s"} stay published and keep their attribution.`
          : "";
      const ok = window.confirm(
        `Move ${name} to draft?\n\nIt comes off /developers, its profile page starts returning "not found", and it leaves the sitemap.${tail}`,
      );
      if (!ok) return;
    }

    startTransition(async () => {
      const result = await setDeveloperPublished(id, !published);
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <h2 className="text-[13.5px] font-medium">Visibility</h2>
            <span
              className={cn(
                "inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-medium",
                published
                  ? "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]"
                  : "bg-bz-surface-2 text-bz-muted",
              )}
            >
              {published ? "Live" : "Draft"}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-bz-muted leading-relaxed max-w-[62ch]">
            {published ? (
              <>
                Listed on <span className="mono">/developers</span>, reachable at{" "}
                <span className="mono">/developers/{slug}</span>, and in the
                sitemap. Moving it to draft removes all three.
              </>
            ) : (
              <>
                Off <span className="mono">/developers</span>, out of the
                sitemap, and its page returns &ldquo;not found&rdquo;. It stays
                pickable on properties and projects, so nothing loses its
                attribution.
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onToggle}
          disabled={pending}
        >
          {published ? <EyeOff size={13} strokeWidth={1.8} /> : <Eye size={13} strokeWidth={1.8} />}
          {pending ? "Saving…" : published ? "Unpublish" : "Publish"}
        </Button>
      </div>
    </section>
  );
}
