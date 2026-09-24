"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { arKey } from "@/lib/master-pages";
import type { SectionDef, SectionValues } from "@/lib/master-pages";
import type { CardKey } from "@/lib/master-pages/cards";
import { FieldEditor } from "../../../_fields/field-editor";
import { saveCard, resetCard } from "../_actions";
import { AdvisorCardPreview, type PreviewProject } from "./_advisor-preview";

/**
 * The card's fields and, where the card has one, the live preview above them.
 *
 * Its own small form rather than `MasterPageEditor`: that editor is a list of
 * collapsible, reorderable, hideable sections, and a card is one section that
 * can be none of those things. What it needs instead is its values lifted to
 * where the preview can read them on every keystroke.
 */
export function CardEditor({
  cardKey,
  cardLabel,
  section,
  initialValues,
  edited,
  preview,
  projects,
}: {
  cardKey: CardKey;
  cardLabel: string;
  section: SectionDef;
  initialValues: SectionValues;
  edited: boolean;
  preview: "project-advisor" | null;
  projects: PreviewProject[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function set(key: string, v: SectionValues[string]) {
    setValues((cur) => ({ ...cur, [key]: v }));
    setDirty(true);
  }

  function onSave() {
    startTransition(async () => {
      const result = await saveCard(cardKey, [
        { key: section.key, enabled: true, values },
      ]);
      if (result.status === "ok") {
        toast.success(result.message);
        setDirty(false);
        router.refresh();
      } else if (result.status === "invalid") {
        toast.error(result.message, {
          description: result.issues.slice(0, 4).join("\n"),
        });
      } else {
        toast.error(result.message);
      }
    });
  }

  function onReset() {
    if (
      !confirm(
        `Put the ${cardLabel.toLowerCase()} back to the wording it shipped with, in both languages? Only this card is reset.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await resetCard(cardKey);
      if (result.status === "ok") {
        toast.success("Back to the shipped wording.");
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {preview === "project-advisor" ? (
        <AdvisorCardPreview
          cardKey={cardKey}
          values={values}
          projects={projects}
        />
      ) : null}

      <section className="rounded-lg border border-bz-border bg-bz-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-bz-border px-4 py-3">
          <div className="me-auto">
            <h2 className="text-[13.5px] font-medium">Wording</h2>
            <p className="text-[11.5px] text-bz-muted">
              {section.fields.length} fields, each with its Arabic
              {edited ? "" : " · never edited — showing the wording from code"}
              {dirty ? " · unsaved changes" : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            disabled={pending}
          >
            <RotateCcw size={13} strokeWidth={1.8} />
            Reset this card
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSave}
            disabled={pending || !dirty}
          >
            <Save size={13} strokeWidth={1.8} />
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          {section.fields.map((field) => (
            <FieldEditor
              key={field.key}
              field={field}
              value={values[field.key]}
              media={[]}
              onMediaAdded={() => {}}
              seeds={{}}
              onChange={(v) => set(field.key, v)}
              arValue={
                typeof values[arKey(field.key)] === "string"
                  ? (values[arKey(field.key)] as string)
                  : ""
              }
              onArChange={(v) => set(arKey(field.key), v)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
