"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowLeft,
  Blocks,
  CalendarHeart,
  FileText,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Megaphone,
  Newspaper,
  Plus,
  Rocket,
  House,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { STARTERS, STARTER_META, type Starter } from "@/lib/newsletter/starters";
import { BUILT_IN_TEMPLATES, type BuiltInTemplate } from "@/lib/newsletter/blocks/templates";
import { createCampaign } from "./_actions";

const ICON: Record<Starter, typeof Plus> = {
  blank: FileText,
  digest: Newspaper,
  listings: House,
  launches: Rocket,
  insights: LayoutGrid,
};

const TEMPLATE_ICON: Record<BuiltInTemplate, typeof Plus> = {
  launch: Rocket,
  listings: House,
  market: TrendingUp,
  event: CalendarHeart,
  announcement: Megaphone,
  "blocks-blank": Blocks,
};

export type SavedTemplateOption = {
  id: string;
  name: string;
  description: string;
};
export type ProjectOption = { id: string; name: string; area: string };

function Choice({
  name,
  value,
  label,
  hint,
  icon: Icon,
  chosen,
  onChoose,
}: {
  name: string;
  value: string;
  label: string;
  hint: string;
  icon: typeof Plus;
  chosen: string | null;
  onChoose: (s: string) => void;
}) {
  const { pending } = useFormStatus();
  const busy = pending && chosen === value;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={() => onChoose(value)}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-start transition-colors",
        "border-bz-border hover:border-bz-navy hover:bg-bz-surface-2 disabled:opacity-60",
        busy && "border-bz-navy bg-bz-surface-2",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bz-surface-2 text-bz-ink-2">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} strokeWidth={1.8} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-bz-ink">{label}</span>
        <span className="block text-[11.5px] leading-snug text-bz-muted">{hint}</span>
      </span>
    </button>
  );
}

/** A template that asks for more before it can be made: opens its own step. */
function NextStepChoice({
  label,
  hint,
  icon: Icon,
  onChoose,
}: {
  label: string;
  hint: string;
  icon: typeof Plus;
  onChoose: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onChoose}
      className="flex items-start gap-3 rounded-lg border border-bz-border p-3 text-start transition-colors hover:border-bz-navy hover:bg-bz-surface-2 disabled:opacity-60"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bz-surface-2 text-bz-ink-2">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-bz-ink">{label}</span>
        <span className="block text-[11.5px] leading-snug text-bz-muted">{hint}</span>
      </span>
    </button>
  );
}

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 size={14} className="animate-spin" /> : null}
      Create
    </Button>
  );
}

/**
 * "New newsletter": a block-built email from a template (Bazar's own, or one
 * the team saved), or a rich-text page — blank or a starter layout filled
 * with what is newest on the site (lib/newsletter/starters.ts).
 */
export function NewNewsletterButton({ templates = [], projects = [] }: { templates?: SavedTemplateOption[]; projects?: ProjectOption[] }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [project, setProject] = useState(projects[0]?.id ?? "");
  /*
   * Template first, content second (client, Nov 2026). The project picker
   * used to sit above every template, so the team chose a project before
   * saying what they were making. A template that needs one now opens a
   * second step for it; the rest create at once.
   */
  const [needsProjectFor, setNeedsProjectFor] = useState<BuiltInTemplate | null>(null);
  const pickedTemplate = needsProjectFor ? BUILT_IN_TEMPLATES.find((t) => t.id === needsProjectFor) : null;
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus size={14} strokeWidth={1.8} />
        New newsletter
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setNeedsProjectFor(null);
        }}
      >
        <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New newsletter</DialogTitle>
            <DialogDescription>
              Build it from blocks — a launch mailer, an invitation, your own layout — or write it as a page of rich
              text. English and Arabic either way; everything can be changed in the editor.
            </DialogDescription>
          </DialogHeader>

          {pickedTemplate ? (
            <form action={createCampaign} className="flex flex-col gap-4">
              <input type="hidden" name="template" value={pickedTemplate.id} />
              <div className="flex items-start gap-3 rounded-lg border border-bz-navy bg-bz-surface-2 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-bz-bg text-bz-ink-2">
                  {(() => {
                    const Icon = TEMPLATE_ICON[pickedTemplate.id];
                    return <Icon size={15} strokeWidth={1.8} />;
                  })()}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-bz-ink">{pickedTemplate.label}</span>
                  <span className="block text-[11.5px] leading-snug text-bz-muted">{pickedTemplate.hint}</span>
                </span>
              </div>
              <label className="flex flex-col gap-1.5 text-[12px] text-bz-ink-2">
                Which project is it launching?
                <select
                  name="project"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  className="h-9 border border-bz-border rounded px-2 text-[13px] bg-bz-bg"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.area ? ` — ${p.area}` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-[11.5px] text-bz-muted">
                  Its photos, unit types, amenities and facts fill the mailer. Every block can be changed in the editor.
                </span>
              </label>
              <div className="flex items-center justify-between gap-2">
                <Button type="button" variant="ghost" onClick={() => setNeedsProjectFor(null)}>
                  <ArrowLeft size={14} strokeWidth={1.8} />
                  Back
                </Button>
                <CreateButton />
              </div>
            </form>
          ) : (
            <form action={createCampaign} className="flex flex-col gap-5">
              <section className="flex flex-col gap-2">
                <h3 className="text-[12px] font-medium text-bz-ink-2">Built from blocks</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BUILT_IN_TEMPLATES.filter((t) => !t.needsProject || projects.length > 0).map((t) =>
                    t.needsProject ? (
                      <NextStepChoice
                        key={t.id}
                        label={t.label}
                        hint={t.hint}
                        icon={TEMPLATE_ICON[t.id]}
                        onChoose={() => setNeedsProjectFor(t.id)}
                      />
                    ) : (
                      <Choice
                        key={t.id}
                        name="template"
                        value={t.id}
                        label={t.label}
                        hint={t.hint}
                        icon={TEMPLATE_ICON[t.id]}
                        chosen={chosen}
                        onChoose={setChosen}
                      />
                    ),
                  )}
                </div>
              </section>

              {templates.length > 0 ? (
                <section className="flex flex-col gap-2">
                  <h3 className="text-[12px] font-medium text-bz-ink-2">Your templates</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {templates.map((t) => (
                      <Choice
                        key={t.id}
                        name="template"
                        value={t.id}
                        label={t.name}
                        hint={t.description || "Saved by your team."}
                        icon={LayoutTemplate}
                        chosen={chosen}
                        onChoose={setChosen}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="flex flex-col gap-2">
                <h3 className="text-[12px] font-medium text-bz-ink-2">Rich text</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STARTERS.map((s) => (
                    <Choice
                      key={s}
                      name="starter"
                      value={s}
                      label={STARTER_META[s].label}
                      hint={STARTER_META[s].hint}
                      icon={ICON[s]}
                      chosen={chosen}
                      onChoose={setChosen}
                    />
                  ))}
                </div>
              </section>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
