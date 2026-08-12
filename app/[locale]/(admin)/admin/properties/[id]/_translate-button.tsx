"use client";

import { useState, useTransition } from "react";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  translatePropertyArabic,
  type FieldOutcome,
} from "./_translate-actions";

/**
 * "Translate to Arabic" — the whole drain, for a corpus of 18.
 *
 * The translation is written immediately, not staged in the form. That is the
 * standing decision for machine translation on this site — publish it, let it
 * be edited afterwards, and mark its provenance — and it is the right one
 * here: an Arabic field that only exists until someone remembers to press Save
 * is a translation run that silently did nothing.
 *
 * The fields are filled in afterwards so the editor sees what landed, but they
 * are NOT marked dirty, because there is nothing outstanding to save. Editing
 * one dirties it in the ordinary way.
 *
 * Failures are shown per field and are not silent. A field that fails keeps
 * its English, which is the designed public fallback — so a partial run is a
 * normal outcome rather than an error state.
 */
export function TranslateButton({
  propertyId,
  onTranslated,
}: {
  propertyId: string;
  onTranslated: (field: string, text: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [failures, setFailures] = useState<FieldOutcome[]>([]);

  function run() {
    startTransition(async () => {
      const result = await translatePropertyArabic(propertyId);

      if (result.status === "error") {
        setFailures([]);
        toast.error(result.message);
        return;
      }

      const done = result.fields.filter((f) => f.status === "translated");
      const failed = result.fields.filter((f) => f.status === "failed");
      setFailures(failed);

      for (const field of done) {
        if (field.status === "translated") {
          onTranslated(`${field.field}_ar`, field.text);
        }
      }

      if (done.length === 0 && failed.length === 0) {
        toast.info("Nothing to translate — no English text in these fields.");
      } else if (failed.length === 0) {
        toast.success(
          `Translated and saved ${done.length} field${done.length === 1 ? "" : "s"}.`,
        );
      } else {
        toast.warning(
          `Saved ${done.length}, rejected ${failed.length}. The rejected fields keep their English.`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={run}
          disabled={pending}
        >
          <Languages size={14} strokeWidth={1.75} />
          {pending ? "Translating…" : "Translate to Arabic"}
        </Button>
        <span className="text-[11.5px] text-bz-muted">
          Writes the Arabic fields below. Saved immediately; edit them afterwards.
        </span>
      </div>

      {failures.length > 0 ? (
        <div className="rounded-md border border-bz-border bg-bz-bg p-3 flex flex-col gap-2">
          {failures.map((f) =>
            f.status === "failed" ? (
              <div key={f.field} className="flex flex-col gap-0.5">
                <span className="text-[11.5px] text-bz-ink">
                  {f.field.replace(/_/g, " ")} — rejected
                </span>
                <ul className="text-[11px] text-bz-muted list-disc ps-4">
                  {f.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
                {/* The rejected text, so a reviewer can see whether the check
                    was right rather than having to take it on trust. */}
                <span
                  lang="ar"
                  dir="rtl"
                  className="text-[11.5px] text-bz-muted-2 truncate"
                >
                  {f.raw}
                </span>
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
