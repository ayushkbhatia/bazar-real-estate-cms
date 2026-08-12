"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteDevelopment } from "../_actions";

/**
 * Delete a project, permanently.
 *
 * Deliberately awkward. Removing a development takes its media, units and
 * floor plans with it (Postgres cascades those — they mean nothing without the
 * project), and quietly detaches any enquiry or property that pointed at it,
 * because those columns are ON DELETE SET NULL. An enquiry is a person who
 * asked about this project, so the count is shown before the fact rather than
 * discovered after it.
 *
 * A live project isn't deletable here at all — unpublish first. That keeps the
 * reversible step separate from the irreversible one.
 */
export function DeleteDevelopmentCard({
  developmentId,
  name,
  published,
  enquiryCount,
  propertyCount,
  canDelete,
  recordHref,
}: {
  developmentId: string;
  name: string;
  published: boolean;
  enquiryCount: number;
  propertyCount: number;
  canDelete: boolean;
  recordHref: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const matches = typed.trim() === name;

  function remove() {
    startTransition(async () => {
      const result = await deleteDevelopment(developmentId, typed);
      if (result.status === "error") {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.push("/admin/pages/sub/development");
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
          <h2 className="text-[13.5px] font-medium">Delete this project</h2>
          <p className="mt-0.5 text-[11.5px] text-bz-muted leading-[1.5]">
            Removes the project, its page, and its units, floor plans and
            gallery. This can&apos;t be undone.
          </p>

          {published ? (
            <p className="mt-3 rounded border border-bz-border bg-bz-surface-2 px-3 py-2 text-[11.5px] text-bz-ink-2">
              This project is live, so it can&apos;t be deleted yet.{" "}
              <Link href={recordHref} className="underline underline-offset-2">
                Unpublish it
              </Link>{" "}
              first — that takes it off the public site and is reversible.
            </p>
          ) : (
            <>
              {enquiryCount > 0 || propertyCount > 0 ? (
                <p className="mt-3 rounded border border-[oklch(0.85_0.09_75)] bg-[oklch(0.97_0.03_75)] px-3 py-2 text-[11.5px] text-[oklch(0.35_0.09_60)]">
                  {[
                    enquiryCount > 0
                      ? `${enquiryCount} ${enquiryCount === 1 ? "enquiry" : "enquiries"}`
                      : null,
                    propertyCount > 0
                      ? `${propertyCount} ${propertyCount === 1 ? "listing" : "listings"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" and ")}{" "}
                  {enquiryCount + propertyCount === 1 ? "points" : "point"} at
                  this project. Deleting it keeps{" "}
                  {enquiryCount + propertyCount === 1 ? "that record" : "those records"}{" "}
                  but clears the link, which can&apos;t be restored.
                </p>
              ) : null}

              {open ? (
                <div className="mt-3 flex flex-col gap-2">
                  <label
                    htmlFor="confirm-delete"
                    className="text-[11.5px] text-bz-ink-2"
                  >
                    Type <span className="font-medium">{name}</span> to confirm.
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="confirm-delete"
                      value={typed}
                      autoFocus
                      autoComplete="off"
                      disabled={pending}
                      onChange={(e) => setTyped(e.target.value)}
                      className="max-w-[320px]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending || !matches || !canDelete}
                      onClick={remove}
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                      {pending ? "Deleting…" : "Delete permanently"}
                    </Button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setOpen(false);
                        setTyped("");
                      }}
                      className="text-[11.5px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canDelete}
                    onClick={() => setOpen(true)}
                  >
                    <Trash2 size={13} strokeWidth={1.8} />
                    Delete project
                  </Button>
                  {canDelete ? null : (
                    <p className="mt-2 text-[11.5px] text-bz-muted">
                      Your role can edit this project but not delete it.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
