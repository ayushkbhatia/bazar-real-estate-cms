"use client";

import { useMemo, useState, useTransition } from "react";
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
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MEGAMENU_BADGE_VARIANTS,
  MEGAMENU_BADGE_VARIANT_LABELS,
  MEGAMENU_TARGET_KINDS,
  MEGAMENU_TILE_BADGE_KINDS,
  MEGAMENU_TILE_VARIANTS,
  defaultNewColumn,
  defaultNewFeaturedTile,
  defaultNewItem,
  type ColumnEditInput,
  type FeaturedTileEditInput,
  type MegamenuTab,
  type MegamenuZone,
  type TabEditPayload,
  type TabMetaEditInput,
} from "@/lib/schemas/megamenu";
import { saveMegamenuTab } from "./_actions";

// ───────────────────────────────────────────────────────────────
// Local state types — same as schema, plus a UI-only uid for stable React
// keys (server doesn't care; save is replace-then-insert).
// ───────────────────────────────────────────────────────────────
type LocalItem = ColumnEditInput["items"][number] & { uid: string };
type LocalColumn = Omit<ColumnEditInput, "items"> & { uid: string; items: LocalItem[] };
type LocalTile = FeaturedTileEditInput & { uid: string };

function withUid<T>(row: T): T & { uid: string } {
  return { ...row, uid: crypto.randomUUID() };
}

// Tiny styled <input> / <textarea> / <select> — mirrors the inline form
// styling used in app/(admin)/admin/pages/[id]/_block-list.tsx so the
// look stays consistent across the admin.
const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2 text-[12.5px]";

// ───────────────────────────────────────────────────────────────
// Tiny presentational helpers
// ───────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-bz-muted text-[11px]">{children}</span>;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-bz-surface border border-bz-border rounded-lg p-5 flex flex-col gap-4">
      <header>
        <h3
          className="serif text-[20px]"
          style={{ letterSpacing: "-0.015em" }}
        >
          {title}
        </h3>
        {description ? (
          <p className="text-[12.5px] text-bz-muted mt-0.5">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function DragHandle({ listeners, attributes }: { listeners?: object; attributes?: object }) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="h-7 w-5 inline-flex items-center justify-center text-bz-muted-2 hover:text-bz-ink cursor-grab active:cursor-grabbing"
      {...listeners}
      {...attributes}
    >
      <GripVertical size={14} />
    </button>
  );
}

// ───────────────────────────────────────────────────────────────
// Sortable item row
// ───────────────────────────────────────────────────────────────
function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: LocalItem;
  onChange: (next: LocalItem) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.uid });
  const [expanded, setExpanded] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="border border-bz-border rounded bg-bz-bg"
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <DragHandle listeners={listeners} attributes={attributes} />
        <input
          className={cn(fieldCls, "flex-1")}
          placeholder="Label"
          value={item.label}
          onChange={(e) => onChange({ ...item, label: e.target.value })}
        />
        <input
          className={cn(fieldCls, "flex-1")}
          placeholder="/href"
          value={item.href}
          onChange={(e) => onChange({ ...item, href: e.target.value })}
        />
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="text-[11.5px] text-bz-muted hover:text-bz-ink px-2"
        >
          {expanded ? "Less" : "More"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove item"
          className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-danger hover:bg-bz-surface-2"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded ? (
        <div className="px-9 py-3 border-t border-bz-border grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <FieldLabel>Target kind</FieldLabel>
            <select
              className={fieldCls}
              value={item.target_kind ?? ""}
              onChange={(e) =>
                onChange({
                  ...item,
                  target_kind: e.target.value
                    ? (e.target.value as LocalItem["target_kind"])
                    : null,
                })
              }
            >
              <option value="">— None —</option>
              {MEGAMENU_TARGET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Icon (lucide name)</FieldLabel>
            <input
              className={fieldCls}
              placeholder="building-2"
              value={item.icon ?? ""}
              onChange={(e) =>
                onChange({ ...item, icon: e.target.value || null })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Badge label</FieldLabel>
            <input
              className={fieldCls}
              placeholder="HOT DEALS"
              value={item.badge_label ?? ""}
              onChange={(e) =>
                onChange({ ...item, badge_label: e.target.value || null })
              }
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Badge variant</FieldLabel>
            <select
              className={fieldCls}
              value={item.badge_variant}
              onChange={(e) =>
                onChange({
                  ...item,
                  badge_variant: e.target.value as LocalItem["badge_variant"],
                })
              }
            >
              {MEGAMENU_BADGE_VARIANTS.map((v) => (
                <option key={v} value={v}>
                  {MEGAMENU_BADGE_VARIANT_LABELS[v]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
// Sortable column wrapper
// ───────────────────────────────────────────────────────────────
function ColumnCard({
  column,
  onChange,
  onRemove,
}: {
  column: LocalColumn;
  onChange: (next: LocalColumn) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: column.uid });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleItemDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = column.items.findIndex((i) => i.uid === active.id);
    const newIndex = column.items.findIndex((i) => i.uid === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange({
      ...column,
      items: arrayMove(column.items, oldIndex, newIndex),
    });
  }

  function setItem(idx: number, next: LocalItem) {
    const items = column.items.slice();
    items[idx] = next;
    onChange({ ...column, items });
  }

  function addItem() {
    onChange({
      ...column,
      items: [...column.items, withUid(defaultNewItem(column.items.length))],
    });
  }

  function removeItem(idx: number) {
    onChange({ ...column, items: column.items.filter((_, i) => i !== idx) });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-bz-border rounded-lg bg-bz-surface-2 p-3 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <DragHandle listeners={listeners} attributes={attributes} />
        <input
          className={cn(fieldCls, "flex-1")}
          placeholder="Column heading (optional)"
          value={column.heading ?? ""}
          onChange={(e) =>
            onChange({ ...column, heading: e.target.value || null })
          }
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove column"
          className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-danger hover:bg-bz-bg"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleItemDragEnd}
      >
        <SortableContext
          items={column.items.map((i) => i.uid)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-1.5">
            {column.items.map((item, idx) => (
              <ItemRow
                key={item.uid}
                item={item}
                onChange={(next) => setItem(idx, next)}
                onRemove={() => removeItem(idx)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus size={13} strokeWidth={1.8} /> Add item
      </Button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Zone-level sortable list of columns
// ───────────────────────────────────────────────────────────────
function ZoneEditor({
  zone,
  columns,
  onColumnsChange,
}: {
  zone: MegamenuZone;
  columns: LocalColumn[];
  onColumnsChange: (next: LocalColumn[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((c) => c.uid === active.id);
    const newIndex = columns.findIndex((c) => c.uid === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onColumnsChange(arrayMove(columns, oldIndex, newIndex));
  }

  function setColumn(idx: number, next: LocalColumn) {
    const arr = columns.slice();
    arr[idx] = next;
    onColumnsChange(arr);
  }

  function addColumn() {
    onColumnsChange([
      ...columns,
      withUid({
        ...defaultNewColumn(zone, columns.length),
        items: [withUid(defaultNewItem(0))],
      }) as LocalColumn,
    ]);
  }

  function removeColumn(idx: number) {
    onColumnsChange(columns.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={columns.map((c) => c.uid)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-3">
            {columns.length === 0 ? (
              <div className="text-center py-6 text-bz-muted text-[12.5px] border border-dashed border-bz-border rounded">
                No {zone} columns yet.
              </div>
            ) : (
              columns.map((col, idx) => (
                <ColumnCard
                  key={col.uid}
                  column={col}
                  onChange={(next) => setColumn(idx, next)}
                  onRemove={() => removeColumn(idx)}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" size="sm" onClick={addColumn}>
        <Plus size={13} strokeWidth={1.8} /> Add {zone} column
      </Button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Featured tiles (0-2 slots)
// ───────────────────────────────────────────────────────────────
function TileForm({
  tile,
  onChange,
  onRemove,
}: {
  tile: LocalTile;
  onChange: (next: LocalTile) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-bz-border rounded-lg bg-bz-surface-2 p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Tile {tile.position + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove tile"
          className="text-[11.5px] text-bz-muted hover:text-bz-danger"
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <FieldLabel>Variant</FieldLabel>
          <select
            className={fieldCls}
            value={tile.variant}
            onChange={(e) =>
              onChange({
                ...tile,
                variant: e.target.value as LocalTile["variant"],
              })
            }
          >
            {MEGAMENU_TILE_VARIANTS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>Badge kind</FieldLabel>
          <select
            className={fieldCls}
            value={tile.badge_kind}
            onChange={(e) =>
              onChange({
                ...tile,
                badge_kind: e.target.value as LocalTile["badge_kind"],
              })
            }
          >
            {MEGAMENU_TILE_BADGE_KINDS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>Badge label</FieldLabel>
          <input
            className={fieldCls}
            placeholder="New launch"
            value={tile.badge_label ?? ""}
            onChange={(e) =>
              onChange({ ...tile, badge_label: e.target.value || null })
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <FieldLabel>CTA label</FieldLabel>
          <input
            className={fieldCls}
            placeholder="Discover more"
            value={tile.cta_label ?? ""}
            onChange={(e) =>
              onChange({ ...tile, cta_label: e.target.value || null })
            }
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <FieldLabel>Headline</FieldLabel>
          <input
            className={fieldCls}
            value={tile.headline}
            onChange={(e) => onChange({ ...tile, headline: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 col-span-2">
          <FieldLabel>Href</FieldLabel>
          <input
            className={fieldCls}
            value={tile.href}
            onChange={(e) => onChange({ ...tile, href: e.target.value })}
          />
        </label>
      </div>
      <p className="text-[11px] text-bz-muted-2">
        Image picker arrives with the media library integration. Until then,
        tiles render the diagonal-line placeholder.
      </p>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Main editor
// ───────────────────────────────────────────────────────────────
type Props = {
  tab: MegamenuTab;
};

export function MegamenuEditor({ tab }: Props) {
  // Initial state — hydrate from the server-loaded tab and stamp uids.
  const initial = useMemo(() => {
    const left = tab.columns.left.map<LocalColumn>((c) =>
      withUid({
        zone: "left" as const,
        position: c.position,
        heading: c.heading,
        items: c.items.map<LocalItem>((i) =>
          withUid({
            position: i.position,
            label: i.label,
            href: i.href,
            target_kind: i.target_kind,
            target_id: i.target_id,
            icon: i.icon,
            badge_label: i.badge_label,
            badge_variant: i.badge_variant,
          }),
        ),
      }),
    );
    const right = tab.columns.right.map<LocalColumn>((c) =>
      withUid({
        zone: "right" as const,
        position: c.position,
        heading: c.heading,
        items: c.items.map<LocalItem>((i) =>
          withUid({
            position: i.position,
            label: i.label,
            href: i.href,
            target_kind: i.target_kind,
            target_id: i.target_id,
            icon: i.icon,
            badge_label: i.badge_label,
            badge_variant: i.badge_variant,
          }),
        ),
      }),
    );
    const featured = tab.featured.map<LocalTile>((t) =>
      withUid({
        position: t.position,
        variant: t.variant,
        badge_label: t.badge_label,
        badge_kind: t.badge_kind,
        headline: t.headline,
        href: t.href,
        media_asset_id: t.media_asset_id,
        cta_label: t.cta_label,
      }),
    );
    const meta: TabMetaEditInput = {
      label: tab.label,
      href: tab.href,
      has_panel: tab.has_panel,
      panel_title: tab.panel_title,
      panel_title_href: tab.panel_title_href,
      right_column_title: tab.right_column_title,
    };
    return { meta, left, right, featured };
  }, [tab]);

  const [meta, setMeta] = useState<TabMetaEditInput>(initial.meta);
  const [left, setLeft] = useState<LocalColumn[]>(initial.left);
  const [right, setRight] = useState<LocalColumn[]>(initial.right);
  const [featured, setFeatured] = useState<LocalTile[]>(initial.featured);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function patchMeta<K extends keyof TabMetaEditInput>(key: K, value: TabMetaEditInput[K]) {
    setMeta((m) => ({ ...m, [key]: value }));
    setDirty(true);
  }

  function setLeftDirty(next: LocalColumn[]) {
    setLeft(next);
    setDirty(true);
  }
  function setRightDirty(next: LocalColumn[]) {
    setRight(next);
    setDirty(true);
  }
  function setFeaturedDirty(next: LocalTile[]) {
    setFeatured(next);
    setDirty(true);
  }

  function addTile() {
    if (featured.length >= 2) return;
    setFeaturedDirty([
      ...featured,
      withUid(defaultNewFeaturedTile(featured.length)),
    ]);
  }

  function setTile(idx: number, next: LocalTile) {
    const arr = featured.slice();
    arr[idx] = next;
    setFeaturedDirty(arr);
  }

  function removeTile(idx: number) {
    setFeaturedDirty(featured.filter((_, i) => i !== idx));
  }

  function buildPayload(): TabEditPayload {
    // Strip uid before sending; server re-numbers positions from array
    // order so we don't have to manage them here.
    const cleanItems = (items: LocalItem[]) =>
      items.map(({ uid: _uid, ...rest }) => ({ ...rest }));
    const cleanColumn = (c: LocalColumn) => ({
      zone: c.zone,
      position: c.position,
      heading: c.heading ?? null,
      items: cleanItems(c.items),
    });
    const allColumns = [...left, ...right].map(cleanColumn);
    return {
      meta,
      columns: allColumns,
      featured: featured.map(({ uid: _uid, ...rest }) => ({ ...rest })),
    };
  }

  function save() {
    startTransition(async () => {
      const result = await saveMegamenuTab(tab.id, buildPayload());
      if (result.status === "ok") {
        toast.success(result.message ?? "Saved.");
        setDirty(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-bz-bg/95 backdrop-blur flex items-center justify-end gap-3 border-b border-bz-border">
        {dirty ? (
          <span className="text-[11.5px] text-bz-danger">Unsaved changes</span>
        ) : (
          <span className="text-[11.5px] text-bz-muted">All saved</span>
        )}
        <Button onClick={save} disabled={pending || !dirty} size="sm">
          {pending ? "Saving…" : "Save tab"}
        </Button>
      </div>

      {/* Meta */}
      <Section title="Tab metadata">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <FieldLabel>Label</FieldLabel>
            <input
              className={fieldCls}
              value={meta.label}
              onChange={(e) => patchMeta("label", e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-1.5">
            <input
              type="checkbox"
              checked={meta.has_panel}
              onChange={(e) => patchMeta("has_panel", e.target.checked)}
            />
            <span className="text-[12.5px]">Has dropdown panel</span>
          </label>
          {meta.has_panel ? (
            <>
              <label className="flex flex-col gap-1">
                <FieldLabel>Panel title</FieldLabel>
                <input
                  className={fieldCls}
                  value={meta.panel_title ?? ""}
                  onChange={(e) =>
                    patchMeta("panel_title", e.target.value || null)
                  }
                />
              </label>
              <label className="flex flex-col gap-1">
                <FieldLabel>Panel title href (links the section title)</FieldLabel>
                <input
                  className={fieldCls}
                  value={meta.panel_title_href ?? ""}
                  onChange={(e) =>
                    patchMeta("panel_title_href", e.target.value || null)
                  }
                />
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <FieldLabel>Right column title (e.g. &ldquo;Other Locations&rdquo;)</FieldLabel>
                <input
                  className={fieldCls}
                  value={meta.right_column_title ?? ""}
                  onChange={(e) =>
                    patchMeta("right_column_title", e.target.value || null)
                  }
                />
              </label>
            </>
          ) : (
            <label className="flex flex-col gap-1 col-span-2">
              <FieldLabel>Direct link href</FieldLabel>
              <input
                className={fieldCls}
                placeholder="/insights"
                value={meta.href ?? ""}
                onChange={(e) => patchMeta("href", e.target.value || null)}
              />
            </label>
          )}
        </div>
      </Section>

      {meta.has_panel ? (
        <>
          {/* Featured tiles */}
          <Section
            title="Featured tiles"
            description="Up to two large promo cards rendered in the middle of the panel."
          >
            <div className="flex flex-col gap-3">
              {featured.map((tile, idx) => (
                <TileForm
                  key={tile.uid}
                  tile={tile}
                  onChange={(next) => setTile(idx, next)}
                  onRemove={() => removeTile(idx)}
                />
              ))}
              {featured.length < 2 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTile}
                >
                  <Plus size={13} strokeWidth={1.8} /> Add tile
                </Button>
              ) : null}
            </div>
          </Section>

          {/* Left columns */}
          <Section
            title="Left zone — columns"
            description="Lists of links on the left of the panel. Drag to reorder columns and items."
          >
            <ZoneEditor zone="left" columns={left} onColumnsChange={setLeftDirty} />
          </Section>

          {/* Right columns */}
          <Section
            title="Right zone — columns"
            description="Sub-locations / sub-markets. Optional."
          >
            <ZoneEditor zone="right" columns={right} onColumnsChange={setRightDirty} />
          </Section>
        </>
      ) : (
        <Section title="Direct link tab">
          <p className="text-[12.5px] text-bz-muted">
            This tab has no dropdown panel. The label links directly to the
            href above.
          </p>
        </Section>
      )}
    </div>
  );
}
