"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  areaIsDeletable,
  describeAreaBlockers,
  describeUnpublished,
  type AreaUsage,
  type AreaUsageGroup,
} from "@/lib/area-usage";
import { deleteArea } from "../../pages/sub/area/_record-actions";

/**
 * Delete an area, permanently.
 *
 * Offered only once nothing live sits in it. A published listing, published
 * project or child area that points here is named, with a link to its editor,
 * and the button stays disabled until each has been moved — the database
 * refuses the delete in any case (migrations 0167, 0170), so this is about
 * saying which records, not about enforcing it.
 *
 * Unpublished listings and projects don't block. They are named too, as a
 * warning: the delete leaves them without an area.
 *
 * When the area is free, the delete still asks: a dialog that spells out what
 * goes with it and wants the name typed back.
 */
export function DeleteAreaCard({
  areaId,
  name,
  slug,
  usage,
  canDelete,
}: {
  areaId: string;
  name: string;
  slug: string;
  usage: AreaUsage;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const deletable = areaIsDeletable(usage);
  const blockers = describeAreaBlockers(usage);
  const unpublished = describeUnpublished(usage);
  const matches = typed.trim() === name;

  function close(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) setTyped("");
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteArea(areaId, typed);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      setOpen(false);
      router.push("/admin/pages/sub/area");
    });
  }

  return (
    <section className="rounded-lg border border-[oklch(0.85_0.09_28)] bg-bz-surface p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={14}
          className="mt-0.5 shrink-0 text-[oklch(0.5_0.15_28)]"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-medium">Delete this area</h2>
          <p className="mt-0.5 text-[11.5px] text-bz-muted leading-[1.5]">
            Removes the area, its guide page and its place on the maps.
            This can&apos;t be undone.
          </p>

          {!deletable ? (
            <div className="mt-3 rounded border border-[oklch(0.85_0.09_75)] bg-[oklch(0.97_0.03_75)] px-3 py-2 text-[11.5px] text-[oklch(0.35_0.09_60)]">
              <p>
                This area can&apos;t be deleted while it has {blockers}. Move
                each one to another area first.
              </p>
              <UsageList title="Published listings" group={usage.properties} />
              <UsageList title="Published projects" group={usage.developments} />
              <UsageList title="Areas inside it" group={usage.children} />
            </div>
          ) : (
            <div className="mt-3">
              {unpublished ? (
                <div className="mb-3 rounded border border-bz-border bg-bz-bg px-3 py-2 text-[11.5px] text-bz-ink-2">
                  <p>
                    It still holds {unpublished}. None is on the site, so they
                    don&apos;t stop the delete — but they&apos;ll be left
                    without an area, and need one before they&apos;re
                    published.
                  </p>
                  <UsageList
                    title="Unpublished listings"
                    group={usage.unpublished.properties}
                  />
                  <UsageList
                    title="Unpublished projects"
                    group={usage.unpublished.developments}
                  />
                </div>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!canDelete}
                onClick={() => setOpen(true)}
              >
                <Trash2 size={13} strokeWidth={1.8} />
                Delete area
              </Button>
              {canDelete ? null : (
                <p className="mt-2 text-[11.5px] text-bz-muted">
                  Your role can edit this area but not delete it.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              Are you sure? The area and its guide page at{" "}
              <span className="mono">/areas/{slug}</span>, with its copy and
              imagery, are removed for good. No published listing, published
              project or area sits in it.
              {unpublished
                ? ` Its ${unpublished} will be left without an area.`
                : ""}
              {usage.menuLinks > 0
                ? ` ${usage.menuLinks} menu or footer ${usage.menuLinks === 1 ? "link points" : "links point"} at its page and will lead nowhere until changed.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirm-delete-area"
              className="text-[12px] text-bz-ink-2"
            >
              Type <span className="font-medium">{name}</span> to confirm.
            </label>
            <Input
              id="confirm-delete-area"
              value={typed}
              autoFocus
              autoComplete="off"
              disabled={pending}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !matches || !canDelete}
              onClick={remove}
            >
              <Trash2 size={13} strokeWidth={1.8} />
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function UsageList({
  title,
  group,
}: {
  title: string;
  group: AreaUsageGroup;
}) {
  if (group.count === 0) return null;
  const more = group.count - group.sample.length;
  return (
    <div className="mt-2">
      <div className="font-medium">
        {title} ({group.count})
      </div>
      <ul className="mt-0.5 flex flex-col gap-0.5">
        {group.sample.map((item) => (
          <li key={item.id}>
            <Link
              href={item.href}
              className="underline underline-offset-2 hover:text-bz-ink"
            >
              {item.label}
            </Link>
          </li>
        ))}
        {more > 0 ? <li>and {more} more</li> : null}
      </ul>
    </div>
  );
}
