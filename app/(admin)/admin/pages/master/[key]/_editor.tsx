"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  isImageField,
  isListField,
  isSelectField,
  isToggleField,
  type FieldDef,
  type ImageValue,
  type ItemValue,
  type SeedKey,
  type MasterPageKey,
  type SectionDef,
  type SectionValues,
  type StoredSection,
} from "@/lib/master-pages";
import { saveMasterPage, resetMasterPage } from "./_actions";

/**
 * Save/reset are injected so the same editor drives master pages and
 * record-backed sub-pages (development project pages) without a second copy.
 */
export type SectionSaveResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

export type SectionActions = {
  save: (id: string, sections: StoredSection[]) => Promise<SectionSaveResult>;
  reset: (id: string) => Promise<SectionSaveResult>;
};

const MASTER_ACTIONS: SectionActions = {
  save: (id, sections) =>
    saveMasterPage(id as MasterPageKey, sections) as Promise<SectionSaveResult>,
  reset: (id) => resetMasterPage(id as MasterPageKey) as Promise<SectionSaveResult>,
};
import { uploadMedia } from "../../../media/_actions";

export type MediaOption = { id: string; filename: string; url: string };

export type SeedItem = { name: string; href: string; slug: string };

/**
 * Live records behind a list or picker, split by role:
 *
 *  - `options` — everything that *can* be picked (every published development).
 *  - `current` — what the page is showing *right now*, in page order. This is
 *    what the "load what's on the page" button fills in, so the editor starts
 *    from the live section rather than the whole catalogue.
 */
export type SeedSource = { options: SeedItem[]; current: SeedItem[] };
export type Seeds = Partial<Record<SeedKey, SeedSource>>;

export type EditorSection = {
  key: string;
  def: SectionDef;
  enabled: boolean;
  values: SectionValues;
};

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

export function MasterPageEditor({
  pageKey,
  pageLabel,
  path,
  initial,
  media: initialMedia,
  seeds,
  usingDefaults,
  actions = MASTER_ACTIONS,
  allowReorder = true,
  resetLabel = "Reset to defaults",
}: {
  /** Master page key, or the record slug for a sub-page. */
  pageKey: string;
  pageLabel: string;
  path: string;
  initial: EditorSection[];
  media: MediaOption[];
  seeds: Seeds;
  usingDefaults: boolean;
  actions?: SectionActions;
  /**
   * Sub-pages keep the template's order — their anchor sub-nav points at
   * section ids in document order.
   */
  allowReorder?: boolean;
  resetLabel?: string;
}) {
  // Uploads from an image field append here, so a freshly uploaded asset is
  // pickable straight away without a page refresh.
  const [media, setMedia] = useState(initialMedia);
  const router = useRouter();
  const [sections, setSections] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const dndId = useId();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function update(next: EditorSection[]) {
    setSections(next);
    setDirty(true);
  }

  function setSection(key: string, patch: Partial<EditorSection>) {
    update(sections.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.key === active.id);
    const to = sections.findIndex((s) => s.key === over.id);
    if (from < 0 || to < 0) return;
    update(arrayMove(sections, from, to));
  }

  function onSave() {
    startTransition(async () => {
      const payload: StoredSection[] = sections.map((s) => ({
        key: s.key,
        enabled: s.enabled,
        values: s.values,
      }));
      const result = await actions.save(pageKey, payload);
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
        `Reset ${pageLabel} to the copy shipped in code? Every edit on this page is discarded.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await actions.reset(pageKey);
      if (result.status === "ok") {
        toast.success("Reset to defaults.");
        setDirty(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  const hiddenCount = sections.filter((s) => !s.enabled).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-[12.5px] text-bz-muted mr-auto">
          {sections.length} sections
          {hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ""}
          {usingDefaults ? " · never edited — showing the copy from code" : ""}
          {dirty ? " · unsaved changes" : ""}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={pending}>
          <RotateCcw size={13} strokeWidth={1.8} />
          {resetLabel}
        </Button>
        <Button type="button" size="sm" onClick={onSave} disabled={pending || !dirty}>
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.key)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-2">
            {sections.map((section, index) => (
              <SectionRow
                key={section.key}
                section={section}
                index={index}
                expanded={open === section.key}
                onToggleExpand={() =>
                  setOpen(open === section.key ? null : section.key)
                }
                onToggleEnabled={() =>
                  setSection(section.key, { enabled: !section.enabled })
                }
                allowReorder={allowReorder}
                onValues={(values) => setSection(section.key, { values })}
                media={media}
                onMediaAdded={(m) => setMedia((cur) => [m, ...cur])}
                seeds={seeds}
                path={path}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SectionRow({
  section,
  index,
  expanded,
  onToggleExpand,
  onToggleEnabled,
  onValues,
  media,
  onMediaAdded,
  seeds,
  path,
  allowReorder,
}: {
  section: EditorSection;
  index: number;
  allowReorder: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: () => void;
  onValues: (v: SectionValues) => void;
  media: MediaOption[];
  onMediaAdded: (m: MediaOption) => void;
  seeds: Seeds;
  path: string;
}) {
  const locked = section.def.locked === true || !allowReorder;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.key, disabled: locked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "border border-bz-border rounded-lg bg-bz-surface",
        !section.enabled && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {locked ? (
          <span
            className="h-7 w-7 inline-flex items-center justify-center text-bz-muted-2"
            title={
              allowReorder
                ? "This section is fixed in place"
                : "Section order is fixed by the page template"
            }
          >
            <Lock size={13} strokeWidth={1.7} />
          </span>
        ) : (
          <button
            type="button"
            className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink cursor-grab active:cursor-grabbing"
            aria-label={`Reorder ${section.def.label}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} strokeWidth={1.7} />
          </button>
        )}

        <span className="mono text-[10.5px] text-bz-muted-2 w-5">
          {index + 1}
        </span>

        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 min-w-0 text-left"
        >
          <span className="text-[13.5px] font-medium">{section.def.label}</span>
          <span className="block text-[11.5px] text-bz-muted truncate">
            {section.def.description}
          </span>
        </button>

        {section.def.fields.length === 0 ? (
          <span className="text-[11px] text-bz-muted-2">No editable copy</span>
        ) : null}

        <button
          type="button"
          onClick={onToggleEnabled}
          disabled={section.def.locked === true}
          aria-label={section.enabled ? "Hide section" : "Show section"}
          title={
            section.def.locked === true
              ? "This section can't be hidden"
              : section.enabled
                ? "Hide this section on the live page"
                : "Show this section on the live page"
          }
          className={cn(
            "h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink",
            section.def.locked === true && "opacity-40 cursor-not-allowed",
          )}
        >
          {section.enabled ? (
            <Eye size={13} strokeWidth={1.7} />
          ) : (
            <EyeOff size={13} strokeWidth={1.7} />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-ink"
        >
          <ChevronDown
            size={14}
            strokeWidth={1.7}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {expanded ? (
        <div className="border-t border-bz-border px-3 py-3 flex flex-col gap-3">
          {section.def.dataNote ? (
            <p className="text-[11.5px] text-bz-muted bg-bz-surface-2 rounded px-2.5 py-2">
              {section.def.dataNote}
            </p>
          ) : null}
          {section.def.fields.length === 0 ? (
            <p className="text-[12.5px] text-bz-muted">
              Nothing to edit here — this section renders live data. You can
              still reorder it or hide it from{" "}
              <span className="mono text-bz-ink-2">{path}</span>.
            </p>
          ) : (
            section.def.fields.map((field) => (
              <FieldEditor
                key={field.key}
                field={field}
                value={section.values[field.key]}
                media={media}
                onMediaAdded={onMediaAdded}
                seeds={seeds}
                onChange={(v) =>
                  onValues({ ...section.values, [field.key]: v })
                }
              />
            ))
          )}
        </div>
      ) : null}
    </li>
  );
}

function FieldEditor({
  field,
  value,
  onChange,
  media,
  onMediaAdded,
  seeds,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: SectionValues[string]) => void;
  media: MediaOption[];
  onMediaAdded: (m: MediaOption) => void;
  seeds: Seeds;
}) {
  if (isListField(field)) {
    const items = Array.isArray(value)
      ? (value as Record<string, ItemValue>[])
      : [];
    const seedCurrent = field.seedKey
      ? (seeds[field.seedKey]?.current ?? [])
      : [];
    return (
      <div className="flex flex-col gap-2">
        <FieldLabel label={field.label} help={field.help} />
        {items.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11.5px] text-bz-muted">
              Empty — the section keeps the list it ships with. Add one to take
              over the whole list.
            </p>
            {seedCurrent.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  onChange(
                    seedCurrent.slice(0, field.max).map((s) => ({
                      enabled: true,
                      name: s.name,
                      href: s.href,
                      slug: s.slug,
                      image: { media_id: null, alt: null, label: s.slug },
                    })),
                  )
                }
              >
                <Plus size={12} strokeWidth={1.8} /> Load the{" "}
                {Math.min(seedCurrent.length, field.max)}{" "}
                {field.itemLabel}
                {Math.min(seedCurrent.length, field.max) === 1 ? "" : "s"} on
                the page
              </Button>
            ) : null}
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li
              key={i}
              className="rounded border border-bz-border bg-bz-surface-2 p-2.5 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="mono text-[10.5px] uppercase tracking-wider text-bz-muted">
                  {field.itemLabel} {i + 1}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${field.itemLabel} ${i + 1}`}
                  onClick={() =>
                    onChange(items.filter((_, idx) => idx !== i))
                  }
                  className="h-6 w-6 inline-flex items-center justify-center rounded text-bz-muted hover:text-[oklch(0.45_0.13_28)]"
                >
                  <Trash2 size={12} strokeWidth={1.7} />
                </button>
              </div>
              {field.fields.map((sub) => (
                <ScalarField
                  key={sub.key}
                  field={sub}
                  value={item[sub.key]}
                  media={media}
                  onMediaAdded={onMediaAdded}
                  seeds={seeds}
                  onChange={(v) => {
                    const next = items.slice();
                    next[i] = { ...item, [sub.key]: v };
                    onChange(next);
                  }}
                />
              ))}
            </li>
          ))}
        </ul>
        {items.length < field.max ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              onChange([
                ...items,
                Object.fromEntries(
                  field.fields.map((f) => [
                    f.key,
                    isToggleField(f)
                      ? true
                      : isImageField(f)
                        ? { media_id: null, alt: null, label: null }
                        : "",
                  ]),
                ) as Record<string, ItemValue>,
              ])
            }
          >
            <Plus size={12} strokeWidth={1.8} /> Add {field.itemLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <ScalarField
      field={field}
      value={value as ItemValue}
      onChange={onChange}
      media={media}
      onMediaAdded={onMediaAdded}
      seeds={seeds}
    />
  );
}

function ScalarField({
  field,
  value,
  onChange,
  media,
  onMediaAdded,
  seeds,
}: {
  field: Exclude<FieldDef, { kind: "list" }>;
  value: ItemValue | undefined;
  onChange: (v: ItemValue) => void;
  media: MediaOption[];
  onMediaAdded: (m: MediaOption) => void;
  seeds: Seeds;
}) {
  if (isSelectField(field)) {
    const options = seeds[field.optionsKey]?.options ?? [];
    const picked = typeof value === "string" ? value : "";
    const missing = picked !== "" && !options.some((o) => o.slug === picked);
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={field.label} help={field.help} />
        <select
          className={fieldCls}
          value={picked}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{field.placeholder ?? "Choose one"}</option>
          {/* A pick whose record has since been unpublished or renamed stays
              selectable, so saving doesn't silently drop it. */}
          {missing ? (
            <option value={picked}>{picked} (no longer available)</option>
          ) : null}
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
        {missing ? (
          <span className="text-[11px] text-[oklch(0.45_0.13_28)]">
            This record isn&apos;t published any more — it won&apos;t appear on
            the page.
          </span>
        ) : null}
      </div>
    );
  }

  if (isToggleField(field)) {
    const on = value !== false;
    return (
      <label className="flex items-center gap-2 text-[12.5px] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-bz-accent"
        />
        <span className={cn(!on && "text-bz-muted")}>
          {on ? field.label : `${field.label} — hidden`}
        </span>
      </label>
    );
  }

  if (isImageField(field)) {
    const v: ImageValue =
      value && typeof value === "object"
        ? (value as ImageValue)
        : { media_id: null, alt: null, label: null };
    const picked = media.find((m) => m.id === v.media_id);
    return (
      <div className="flex flex-col gap-1.5">
        <FieldLabel label={field.label} help={field.help} />
        <div className="flex items-start gap-2.5">
          <div className="relative h-14 w-20 flex-shrink-0 rounded overflow-hidden bg-bz-surface-2 border border-bz-border">
            {picked ? (
              <Image
                src={picked.url}
                alt={picked.filename}
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] text-bz-muted-2">
                No image
              </span>
            )}
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <select
              className={fieldCls}
              value={v.media_id ?? ""}
              onChange={(e) =>
                onChange({ ...v, media_id: e.target.value || null })
              }
            >
              <option value="">Placeholder art</option>
              {media.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.filename}
                </option>
              ))}
            </select>
            <input
              className={fieldCls}
              placeholder="Alt text (for screen readers)"
              value={v.alt ?? ""}
              onChange={(e) => onChange({ ...v, alt: e.target.value || null })}
            />
            <div className="flex items-center gap-3">
              <UploadButton
                onUploaded={(m) => {
                  onMediaAdded(m);
                  onChange({ ...v, media_id: m.id });
                }}
              />
              {v.media_id ? (
                <button
                  type="button"
                  onClick={() => onChange({ ...v, media_id: null })}
                  className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink"
                >
                  <X size={11} /> Use placeholder instead
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const text = typeof value === "string" ? value : "";
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel
        label={field.label}
        help={field.help}
        count={field.max ? `${text.length}/${field.max}` : undefined}
      />
      {field.kind === "textarea" ? (
        <textarea
          className={cn(fieldCls, "resize-y min-h-[64px]")}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={fieldCls}
          value={text}
          placeholder={field.kind === "link" ? "/buy/search" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

/**
 * Upload straight from a section's image field. Goes through the same
 * `uploadMedia` action the media library uses, so the file lands in Storage
 * *and* gets a `media_assets` row — the section stores that row's id, which is
 * what keeps section images visible to the library's usage index.
 */
function UploadButton({
  onUploaded,
}: {
  onUploaded: (m: MediaOption) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    form.set("folder", "brand");
    const result = await uploadMedia(form);
    setBusy(false);
    if (result.status === "error") {
      toast.error(result.message);
      return;
    }
    toast.success(`Uploaded "${file.name}" to the media library.`);
    onUploaded({ id: result.id, filename: file.name, url: result.url });
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 text-[11.5px] text-bz-muted hover:text-bz-ink disabled:opacity-50"
      >
        <Upload size={11} strokeWidth={1.8} />
        {busy ? "Uploading…" : "Upload new"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </>
  );
}

function FieldLabel({
  label,
  help,
  count,
}: {
  label: string;
  help?: string;
  count?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11.5px] font-medium text-bz-ink-2">{label}</span>
      {count ? (
        <span className="mono text-[10.5px] text-bz-muted-2">{count}</span>
      ) : null}
      {help && !count ? (
        <span className="text-[10.5px] text-bz-muted-2">{help}</span>
      ) : null}
    </div>
  );
}

export function useMasterSections(initial: EditorSection[]) {
  return useMemo(() => initial, [initial]);
}
