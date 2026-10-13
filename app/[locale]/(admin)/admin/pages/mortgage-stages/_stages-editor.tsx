"use client";

import { useId, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MortgageStage } from "@/lib/mortgage-requests/stages";
import { deleteStage, reorderStages, saveStage, type StageActionResult } from "./_actions";
import { cleanStageName, moveStage, STAGE_NAME_MAX } from "./_logic";

/**
 * Pages & blocks → Mortgage stages: the list, first to last. Each row saves on
 * its own (its name and two switches); a move, an add or a delete saves at
 * once. Every change is one of 0158's SQL functions, through `_actions.ts`.
 */

type Draft = { name: string; stopsClock: boolean; closesFile: boolean };

const FAILED = "That didn't save. Try again.";
const NAME_HINT = `A name needs 1 to ${STAGE_NAME_MAX} characters.`;

function valuesOf(stage: MortgageStage): Draft {
  return { name: stage.name, stopsClock: stage.stopsClock, closesFile: stage.closesFile };
}

function isDirty(stage: MortgageStage, draft: Draft | undefined): boolean {
  return (
    !!draft &&
    (draft.name !== stage.name || draft.stopsClock !== stage.stopsClock || draft.closesFile !== stage.closesFile)
  );
}

export function StagesEditor({ initial }: { initial: MortgageStage[] }) {
  const [stages, setStages] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [newName, setNewName] = useState("");
  const [toDelete, setToDelete] = useState<MortgageStage | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const newNameId = useId();

  /** Run one action: the stages it returns replace the list, and it says how it went. */
  function run(
    key: string,
    action: () => Promise<StageActionResult>,
    after?: (result: StageActionResult) => void,
    opts: { toastFailure?: boolean } = {},
  ) {
    setBusy(key);
    startTransition(async () => {
      let result: StageActionResult;
      try {
        result = await action();
      } catch {
        result = { ok: false, message: FAILED };
      }
      if (result.stages) setStages(result.stages);
      setBusy(null);
      if (result.ok) toast.success(result.message);
      else if (opts.toastFailure !== false) toast.error(result.message);
      after?.(result);
    });
  }

  function setDraft(stage: MortgageStage, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [stage.id]: { ...(d[stage.id] ?? valuesOf(stage)), ...patch } }));
  }

  function clearDraft(stageId: string) {
    setDrafts((d) => {
      const next = { ...d };
      delete next[stageId];
      return next;
    });
  }

  function save(stage: MortgageStage) {
    const draft = drafts[stage.id];
    if (!draft || !cleanStageName(draft.name)) return;
    run(`save:${stage.id}`, () => saveStage({ id: stage.id, ...draft }), (r) => {
      if (r.ok) clearDraft(stage.id);
    });
  }

  function move(stage: MortgageStage, delta: -1 | 1) {
    const next = moveStage(
      stages.map((s) => s.id),
      stage.id,
      delta,
    );
    if (!next) return;
    const previous = stages;
    const byId = new Map(stages.map((s) => [s.id, s]));
    // Shown at once; the list the action returns replaces it.
    setStages(next.map((id, i) => ({ ...byId.get(id)!, position: i + 1 })));
    setAnnouncement(`${stage.name} moved to position ${next.indexOf(stage.id) + 1} of ${next.length}.`);
    run(`move:${stage.id}`, () => reorderStages(next), (r) => {
      if (!r.ok && !r.stages) setStages(previous);
    });
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    const name = cleanStageName(newName);
    if (!name) return;
    run("add", () => saveStage({ id: null, name, stopsClock: false, closesFile: false }), (r) => {
      if (r.ok) {
        setNewName("");
        setAnnouncement(`${name} added as stage ${(r.stages ?? stages).length}.`);
      }
    });
  }

  function confirmDelete() {
    const stage = toDelete;
    if (!stage) return;
    setDeleteError(null);
    run(
      "delete",
      () => deleteStage(stage.id),
      (r) => {
        if (r.ok) {
          clearDraft(stage.id);
          setToDelete(null);
          headingRef.current?.focus();
        } else {
          setDeleteError(r.message);
        }
      },
      { toastFailure: false },
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 ref={headingRef} tabIndex={-1} className="text-[14px] font-medium outline-none">
        {stages.length} {stages.length === 1 ? "stage" : "stages"}, first to last
      </h2>

      <ol className="flex flex-col gap-2" aria-label="Mortgage stages, first to last">
        {stages.map((stage, index) => (
          <StageRow
            key={stage.id}
            stage={stage}
            index={index}
            count={stages.length}
            draft={drafts[stage.id]}
            disabled={pending}
            saving={busy === `save:${stage.id}`}
            onDraft={(patch) => setDraft(stage, patch)}
            onUndo={() => clearDraft(stage.id)}
            onSave={() => save(stage)}
            onMove={(delta) => move(stage, delta)}
            onDelete={() => {
              setDeleteError(null);
              setToDelete(stage);
            }}
          />
        ))}
      </ol>

      <form
        onSubmit={add}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-bz-border bg-bz-surface p-4"
      >
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <label htmlFor={newNameId} className="text-[12px] text-bz-muted">
            New stage
          </label>
          <Input
            id={newNameId}
            value={newName}
            maxLength={STAGE_NAME_MAX}
            placeholder="e.g. Valuation booked"
            onChange={(e) => setNewName(e.target.value)}
            aria-describedby={`${newNameId}-help`}
          />
          <p id={`${newNameId}-help`} className="text-[11.5px] text-bz-muted">
            It goes in last; move it where it belongs.
          </p>
        </div>
        <Button type="submit" disabled={pending || !cleanStageName(newName)}>
          <Plus size={14} strokeWidth={1.8} />
          {busy === "add" ? "Adding…" : "Add stage"}
        </Button>
      </form>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setToDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{toDelete?.name}”?</DialogTitle>
            <DialogDescription>
              It leaves the mortgage board. A stage can only go when no file is on it.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p role="alert" className="rounded-md bg-bz-surface-2 px-3 py-2 text-[13px] text-bz-ink">
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setToDelete(null);
                setDeleteError(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirmDelete}>
              {busy === "delete" ? "Deleting…" : "Delete stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageRow({
  stage,
  index,
  count,
  draft,
  disabled,
  saving,
  onDraft,
  onUndo,
  onSave,
  onMove,
  onDelete,
}: {
  stage: MortgageStage;
  index: number;
  count: number;
  draft: Draft | undefined;
  disabled: boolean;
  saving: boolean;
  onDraft: (patch: Partial<Draft>) => void;
  onUndo: () => void;
  onSave: () => void;
  onMove: (delta: -1 | 1) => void;
  onDelete: () => void;
}) {
  const id = useId();
  const values = draft ?? valuesOf(stage);
  const dirty = isDirty(stage, draft);
  const nameOk = cleanStageName(values.name) !== null;
  const n = index + 1;

  return (
    <li data-stage-id={stage.id} className="rounded-lg border border-bz-border bg-bz-surface p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && nameOk && !disabled) onSave();
        }}
      >
        <div className="flex flex-wrap items-end gap-3">
          <span className="mono w-5 pb-2 text-[12px] text-bz-muted" aria-hidden>
            {n}
          </span>
          <div className="flex min-w-[200px] flex-1 flex-col gap-1">
            <label htmlFor={`${id}-name`} className="text-[12px] text-bz-muted">
              <span className="sr-only">Stage {n} </span>Name
            </label>
            <Input
              id={`${id}-name`}
              value={values.name}
              maxLength={STAGE_NAME_MAX}
              onChange={(e) => onDraft({ name: e.target.value })}
              aria-invalid={!nameOk || undefined}
              aria-describedby={!nameOk ? `${id}-name-error` : undefined}
            />
          </div>
          <div className="flex items-center gap-1 pb-0.5">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Move ${stage.name} up`}
              disabled={disabled || index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp size={14} strokeWidth={1.8} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={`Move ${stage.name} down`}
              disabled={disabled || index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown size={14} strokeWidth={1.8} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${stage.name}`}
              disabled={disabled}
              onClick={onDelete}
              className="text-bz-muted hover:text-bz-danger"
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
        {!nameOk ? (
          <p id={`${id}-name-error`} className="mt-1 ps-8 text-[11.5px] text-bz-danger">
            {NAME_HINT}
          </p>
        ) : null}

        <div className="mt-3 grid gap-3 ps-8 sm:grid-cols-2">
          <Switch
            id={`${id}-clock`}
            label="Answers the applicant"
            help="Moving a file here for the first time stops its 24-hour promise clock."
            checked={values.stopsClock}
            onChange={(checked) => onDraft({ stopsClock: checked })}
          />
          <Switch
            id={`${id}-closes`}
            label="Closes the file"
            help="Files here count as closed, like Disbursed."
            checked={values.closesFile}
            onChange={(checked) => onDraft({ closesFile: checked })}
          />
        </div>

        {dirty ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            <span className="me-auto ps-8 text-[11.5px] text-bz-muted">Unsaved changes</span>
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onUndo}>
              Undo
            </Button>
            <Button type="submit" size="sm" disabled={disabled || !nameOk} aria-label={`Save stage ${n}`}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : null}
      </form>
    </li>
  );
}

function Switch({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-describedby={`${id}-help`}
        className="mt-[3px] size-4 shrink-0 accent-bz-accent"
      />
      <div className="flex flex-col">
        <label htmlFor={id} className="text-[13px] font-medium text-bz-ink">
          {label}
        </label>
        <p id={`${id}-help`} className="text-[12px] leading-relaxed text-bz-muted">
          {help}
        </p>
      </div>
    </div>
  );
}
