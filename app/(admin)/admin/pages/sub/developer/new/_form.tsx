"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { slugify } from "@/lib/slug";
import { createDeveloper } from "../../../../developers/_actions";

/**
 * Add a developer.
 *
 * Only the name is collected: the link is derived from it, and everything else
 * — logo, founding year, description — is edited on the record the operator
 * lands on next. `createDeveloper` reuses an existing row when the name
 * matches one, so this cannot quietly create a second "Aldar".
 */
export function NewDeveloperForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createDeveloper({ name });
      if (result.status === "error") {
        setError(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(
        result.created
          ? `${result.name} added — /developers/${result.slug} is live.`
          : `"${result.name}" already existed — opening it.`,
      );
      router.push(`/admin/developers/${result.slug}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 max-w-2xl">
      <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="developer-name">Developer name</Label>
          <Input
            id="developer-name"
            value={name}
            autoFocus
            placeholder="e.g. Aldar Properties"
            onChange={(e) => setName(e.target.value)}
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
      </div>

      <div className="flex items-center gap-3">
        <p className="text-[12px] text-bz-muted mr-auto">
          You&apos;ll land on the record next, where the logo, founding year and
          description live.
        </p>
        <Button type="submit" disabled={pending || name.trim().length < 2}>
          <Plus size={14} strokeWidth={1.8} />
          {pending ? "Creating…" : "Create developer"}
        </Button>
      </div>
    </form>
  );
}
