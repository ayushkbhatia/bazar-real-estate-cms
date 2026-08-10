"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import { createDeveloper } from "../../../developers/_actions";

export type DeveloperPickerOption = { id: string; name: string };

/**
 * Add a developer without leaving the property wizard.
 *
 * A listing cannot be published without one, so hitting a missing developer
 * mid-edit is a dead end: the alternative is abandoning every unsaved field to
 * go and create it elsewhere. Only the name is collected — `createDeveloper`
 * derives the link and reuses an existing row when the name matches one, so
 * this can't quietly create a second "Aldar". Logo, founding year and
 * description live on the developer's record, linked from the toast.
 */
export function NewDeveloperDialog({
  onCreated,
}: {
  onCreated: (developer: DeveloperPickerOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createDeveloper({ name });
      if (result.status === "error") {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      onCreated({ id: result.id, name: result.name });
      if (result.created) {
        toast.success(
          `${result.name} added — /developers/${result.slug} is live.`,
          {
            description:
              "Add the logo, founding year and description on the developer record.",
            action: {
              label: "Open record",
              onClick: () =>
                window.open(`/admin/developers/${result.id}`, "_blank"),
            },
          },
        );
      } else {
        toast.message(`"${result.name}" already existed — selected it.`);
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus size={13} strokeWidth={1.8} />
          New developer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a developer</DialogTitle>
          <DialogDescription>
            Creates the catalogue record and its public profile. Every future
            listing and project can then be filed under it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-developer-name">Name</Label>
          <Input
            id="new-developer-name"
            value={name}
            autoFocus
            placeholder="e.g. Aldar Properties"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // The trigger sits inside the property form; Enter here must add
              // a developer, not submit the half-filled listing.
              if (e.key === "Enter") {
                e.preventDefault();
                if (name.trim().length >= 2 && !pending) submit();
              }
            }}
          />
          <span className="text-[11.5px] text-bz-muted">
            Public page:{" "}
            <span className="mono">/developers/{slugify(name) || "…"}</span>
          </span>
          {error ? (
            <span className="text-[12px] text-[oklch(0.45_0.13_28)]">
              {error}
            </span>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={pending || name.trim().length < 2}
          >
            <Plus size={14} strokeWidth={1.8} />
            {pending ? "Creating…" : "Create developer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
