"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createCampaign, deleteTemplate, renameTemplate } from "../_actions";

const INPUT = "w-full border border-bz-border rounded p-1.5 text-[13px] bg-bz-bg outline-none focus:border-bz-accent";

/** One saved template: a scaled-down render of its email, and what can be done with it. */
export function TemplateCard({
  id,
  name,
  description,
  html,
  meta,
  canWrite,
}: {
  id: string;
  name: string;
  description: string;
  html: string;
  meta: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({ name, description });
  const [busy, start] = useTransition();

  function save() {
    start(async () => {
      const r = await renameTemplate(id, values);
      if (r.status === "error") toast.error(r.message);
      else {
        toast.success(r.message);
        setEditing(false);
        router.refresh();
      }
    });
  }

  function remove() {
    if (!window.confirm(`Delete the template “${name}”? Newsletters made from it are unchanged.`)) return;
    start(async () => {
      const r = await deleteTemplate(id);
      if (r.status === "error") toast.error(r.message);
      else {
        toast.success(r.message);
        router.refresh();
      }
    });
  }

  return (
    <article className="rounded-lg border border-bz-border bg-bz-surface overflow-hidden flex flex-col">
      <div className="relative h-[300px] overflow-hidden bg-bz-surface-2 border-b border-bz-border">
        <iframe
          title={`${name} preview`}
          srcDoc={html}
          sandbox=""
          tabIndex={-1}
          className="absolute top-0 left-1/2 w-[680px] h-[1100px] origin-top -translate-x-1/2 scale-[0.5] pointer-events-none border-0"
        />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        {editing ? (
          <>
            <input value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} className={INPUT} maxLength={120} aria-label="Name" />
            <textarea
              value={values.description}
              onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
              className={INPUT}
              rows={2}
              maxLength={400}
              aria-label="Description"
            />
          </>
        ) : (
          <>
            <h3 className="text-[14px] font-medium text-bz-ink">{name}</h3>
            {description ? <p className="text-[12.5px] text-bz-ink-2">{description}</p> : null}
          </>
        )}
        <p className="text-[11.5px] text-bz-muted">{meta}</p>
        {canWrite ? (
          <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={save} disabled={busy || !values.name.trim()}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <form action={createCampaign}>
                  <Button size="sm" type="submit" name="template" value={id}>
                    Use template
                  </Button>
                </form>
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil size={13} /> Rename
                </Button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy}
                  className="ms-auto inline-flex items-center gap-1 text-[12px] text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}
