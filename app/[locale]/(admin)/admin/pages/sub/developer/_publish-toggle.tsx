"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { setDeveloperPublished } from "../../../developers/_actions";

/**
 * Publish / unpublish one developer from the catalogue list.
 *
 * Unpublishing is the destructive-feeling direction, so it says what it will
 * do before it does it — a developer with projects and listings behind it
 * disappearing from the public grid is not something to discover afterwards.
 */
export function DeveloperPublishToggle({
  id,
  name,
  published,
  developmentCount,
  propertyCount,
}: {
  id: string;
  name: string;
  published: boolean;
  developmentCount: number;
  propertyCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
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
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
      title={
        published
          ? "Remove from /developers and the sitemap"
          : "Publish to /developers"
      }
    >
      {published ? <EyeOff size={12} /> : <Eye size={12} />}
      {pending ? "Saving…" : published ? "Unpublish" : "Publish"}
    </button>
  );
}
