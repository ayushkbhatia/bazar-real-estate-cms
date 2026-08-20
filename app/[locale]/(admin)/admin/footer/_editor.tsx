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
import { ArabicTwin } from "../_fields/arabic-twin";
import {
  FOOTER_CONTACT_KINDS,
  FOOTER_CONTACT_KIND_LABELS,
  defaultNewFooterColumn,
  defaultNewFooterContactItem,
  defaultNewFooterLink,
  defaultNewFooterSocial,
  type FooterColumnEditInput,
  type FooterColumnKind,
  type FooterContactItemEditInput,
  type FooterEditPayload,
  type FooterLinkEditInput,
  type FooterSettingsEditInput,
  type FooterSocialEditInput,
} from "@/lib/schemas/footer";
import type { FooterRaw } from "@/lib/queries/footer";
import { saveFooter } from "./_actions";

/**
 * The whole footer, editable on one screen.
 *
 * Deliberately the same shape as the megamenu tab editor — sticky save bar,
 * `Section` cards, dnd-kit rows, an `ArabicTwin` collapsed under every English
 * field — because they are the same job on adjacent surfaces and an editor who
 * has learnt one should not have to learn the other.
 *
 * One screen rather than the megamenu's tab-per-page, because the footer is a
 * singleton: there is nothing to navigate between, and a save that covered
 * only part of it would let the screen and the database disagree about
 * something the visitor reads as one object.
 */

type LocalLink = FooterLinkEditInput & { uid: string };
type LocalColumn = Omit<FooterColumnEditInput, "links"> & {
  uid: string;
  links: LocalLink[];
};
type LocalSocial = FooterSocialEditInput & { uid: string };
type LocalContact = FooterContactItemEditInput & { uid: string };

function withUid<T>(row: T): T & { uid: string } {
  return { ...row, uid: crypto.randomUUID() };
}

/**
 * A brand-new column, uids stamped all the way down.
 *
 * `defaultNewFooterColumn` returns the SCHEMA shape, whose links have no uid —
 * so wrapping it in a bare `withUid` gives the column a React key and leaves
 * its starter link without one. Cheap to miss, and the symptom is a list that
 * loses its focus and its expanded/collapsed state on every keystroke.
 */
function newLocalColumn(position: number, kind: FooterColumnKind): LocalColumn {
  const base = defaultNewFooterColumn(position, kind);
  return withUid({ ...base, links: base.links.map((l) => withUid(l)) });
}

const fieldCls =
  "bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-accent text-[12.5px]";

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
        <h3 className="serif text-[20px]" style={{ letterSpacing: "-0.015em" }}>
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

function DragHandle({
  listeners,
  attributes,
}: {
  listeners?: object;
  attributes?: object;
}) {
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

/** dnd-kit wiring, identical for every sortable list on this screen. */
function useReorder<T extends { uid: string }>(
  rows: T[],
  onChange: (next: T[]) => void,
) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((r) => r.uid === active.id);
    const to = rows.findIndex((r) => r.uid === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(rows, from, to));
  }
  return { sensors, onDragEnd };
}

// ───────────────────────────────────────────────────────────────
// Link row
// ───────────────────────────────────────────────────────────────
function LinkRow({
  link,
  onChange,
  onRemove,
}: {
  link: LocalLink;
  onChange: (next: LocalLink) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.uid });
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
          value={link.label}
          onChange={(e) => onChange({ ...link, label: e.target.value })}
        />
        <input
          className={cn(fieldCls, "flex-1")}
          placeholder="/href"
          value={link.href}
          onChange={(e) => onChange({ ...link, href: e.target.value })}
        />
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="text-[11.5px] text-bz-muted hover:text-bz-ink px-2"
        >
          {expanded ? "Less" : "Arabic"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove link"
          className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-danger hover:bg-bz-surface-2"
        >
          <Trash2 size={13} />
        </button>
      </div>
      {expanded ? (
        <div className="px-9 py-3 border-t border-bz-border">
          <FieldLabel>Label</FieldLabel>
          <ArabicTwin
            field={{ key: "label_ar", label: "Label", kind: "text", max: 120 }}
            value={link.label_ar ?? ""}
            onChange={(v) => onChange({ ...link, label_ar: v || null })}
          />
        </div>
      ) : null}
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
// Column card
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.uid });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const { sensors, onDragEnd } = useReorder(column.links, (links) =>
    onChange({ ...column, links }),
  );
  const isLegal = column.kind === "legal";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border border-bz-border rounded-lg bg-bz-bg p-3 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <DragHandle listeners={listeners} attributes={attributes} />
        <div className="flex-1 flex flex-col gap-1">
          <FieldLabel>
            {isLegal ? "Bottom-bar links (no heading)" : "Column heading"}
          </FieldLabel>
          {isLegal ? null : (
            <>
              <input
                className={fieldCls}
                placeholder="Company"
                value={column.heading ?? ""}
                onChange={(e) =>
                  onChange({ ...column, heading: e.target.value || null })
                }
              />
              <ArabicTwin
                field={{
                  key: "heading_ar",
                  label: "Heading",
                  kind: "text",
                  max: 80,
                }}
                value={column.heading_ar ?? ""}
                onChange={(v) => onChange({ ...column, heading_ar: v || null })}
              />
            </>
          )}
        </div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-bz-muted self-start pt-4">
          <input
            type="checkbox"
            checked={column.is_visible}
            onChange={(e) =>
              onChange({ ...column, is_visible: e.target.checked })
            }
          />
          Visible
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove column"
          className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-danger hover:bg-bz-surface-2 self-start mt-3"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={column.links.map((l) => l.uid)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-1.5">
            {column.links.map((link, idx) => (
              <LinkRow
                key={link.uid}
                link={link}
                onChange={(next) => {
                  const arr = column.links.slice();
                  arr[idx] = next;
                  onChange({ ...column, links: arr });
                }}
                onRemove={() =>
                  onChange({
                    ...column,
                    links: column.links.filter((_, i) => i !== idx),
                  })
                }
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          onChange({
            ...column,
            links: [
              ...column.links,
              withUid(defaultNewFooterLink(column.links.length)),
            ],
          })
        }
      >
        <Plus size={13} strokeWidth={1.8} /> Add link
      </Button>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Social row
// ───────────────────────────────────────────────────────────────
function SocialRow({
  social,
  onChange,
  onRemove,
}: {
  social: LocalSocial;
  onChange: (next: LocalSocial) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: social.uid });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 border border-bz-border rounded bg-bz-bg px-2 py-1.5"
    >
      <DragHandle listeners={listeners} attributes={attributes} />
      <input
        className={cn(fieldCls, "w-[140px]")}
        placeholder="Instagram"
        value={social.label}
        onChange={(e) => onChange({ ...social, label: e.target.value })}
      />
      <input
        className={cn(fieldCls, "flex-1")}
        placeholder="https://…"
        value={social.href}
        onChange={(e) => onChange({ ...social, href: e.target.value })}
      />
      <label className="flex items-center gap-1.5 text-[11.5px] text-bz-muted">
        <input
          type="checkbox"
          checked={social.is_visible}
          onChange={(e) => onChange({ ...social, is_visible: e.target.checked })}
        />
        Visible
      </label>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove social link"
        className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-danger hover:bg-bz-surface-2"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
// Contact row
// ───────────────────────────────────────────────────────────────
function ContactRow({
  item,
  onChange,
  onRemove,
}: {
  item: LocalContact;
  onChange: (next: LocalContact) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.uid });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  /* A phone number and an email address are identities, not prose. Offering an
     Arabic box for them invites someone to type Arabic-Indic digits into a
     `tel:` and break dialling — so the twin is offered for the label always,
     and for the body only where the body is words. */
  const bodyTranslatable = item.kind === "address" || item.kind === "text";

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="border border-bz-border rounded bg-bz-bg p-3 flex flex-col gap-3"
    >
      <div className="flex items-start gap-2">
        <DragHandle listeners={listeners} attributes={attributes} />
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <FieldLabel>Label</FieldLabel>
            <input
              className={fieldCls}
              placeholder="Office location"
              value={item.label}
              onChange={(e) => onChange({ ...item, label: e.target.value })}
            />
            <ArabicTwin
              field={{ key: "label_ar", label: "Label", kind: "text", max: 60 }}
              value={item.label_ar ?? ""}
              onChange={(v) => onChange({ ...item, label_ar: v || null })}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Type</FieldLabel>
            <select
              className={fieldCls}
              value={item.kind}
              onChange={(e) =>
                onChange({
                  ...item,
                  kind: e.target.value as LocalContact["kind"],
                })
              }
            >
              {FOOTER_CONTACT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {FOOTER_CONTACT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel>Value — one per line</FieldLabel>
            <textarea
              className={cn(fieldCls, "resize-y min-h-[64px] leading-[1.6]")}
              value={item.body}
              onChange={(e) => onChange({ ...item, body: e.target.value })}
            />
            {bodyTranslatable ? (
              <ArabicTwin
                field={{
                  key: "body_ar",
                  label: "Value",
                  kind: "textarea",
                  max: 400,
                }}
                value={item.body_ar ?? ""}
                onChange={(v) => onChange({ ...item, body_ar: v || null })}
              />
            ) : (
              <span className="text-[10.5px] text-bz-muted-2">
                Numbers and addresses of this type are shown as-is in both
                languages.
              </span>
            )}
          </label>
        </div>
        <label className="flex items-center gap-1.5 text-[11.5px] text-bz-muted pt-5">
          <input
            type="checkbox"
            checked={item.is_visible}
            onChange={(e) => onChange({ ...item, is_visible: e.target.checked })}
          />
          Visible
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove contact entry"
          className="h-7 w-7 inline-flex items-center justify-center rounded text-bz-muted hover:text-bz-danger hover:bg-bz-surface-2 mt-4"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
// Main editor
// ───────────────────────────────────────────────────────────────
export function FooterEditor({ footer }: { footer: FooterRaw }) {
  const initial = useMemo(() => {
    const linksByColumn = new Map<string, typeof footer.links>();
    for (const link of footer.links) {
      const arr = linksByColumn.get(link.column_id) ?? [];
      arr.push(link);
      linksByColumn.set(link.column_id, arr);
    }
    const toColumn = (c: (typeof footer.columns)[number]): LocalColumn =>
      withUid({
        kind: c.kind,
        position: c.position,
        heading: c.heading,
        heading_ar: c.heading_ar,
        is_visible: c.is_visible,
        links: (linksByColumn.get(c.id) ?? [])
          .slice()
          .sort((a, b) => a.position - b.position)
          .map<LocalLink>((l) =>
            withUid({
              position: l.position,
              label: l.label,
              label_ar: l.label_ar,
              href: l.href,
            }),
          ),
      });
    const ordered = footer.columns
      .slice()
      .sort((a, b) => a.position - b.position);

    const settings: FooterSettingsEditInput = {
      blurb: footer.settings?.blurb ?? null,
      blurb_ar: footer.settings?.blurb_ar ?? null,
      contact_heading: footer.settings?.contact_heading ?? null,
      contact_heading_ar: footer.settings?.contact_heading_ar ?? null,
      legal_line: footer.settings?.legal_line ?? null,
      legal_line_ar: footer.settings?.legal_line_ar ?? null,
    };
    return {
      settings,
      columns: ordered.filter((c) => c.kind === "links").map(toColumn),
      legal: ordered.filter((c) => c.kind === "legal").map(toColumn),
      socials: footer.socials.map<LocalSocial>((s) =>
        withUid({
          position: s.position,
          label: s.label,
          href: s.href,
          is_visible: s.is_visible,
        }),
      ),
      contact: footer.contact.map<LocalContact>((c) =>
        withUid({
          position: c.position,
          kind: c.kind,
          label: c.label,
          label_ar: c.label_ar,
          body: c.body,
          body_ar: c.body_ar,
          is_visible: c.is_visible,
        }),
      ),
    };
  }, [footer]);

  const [settings, setSettings] = useState(initial.settings);
  const [columns, setColumns] = useState(initial.columns);
  const [legal, setLegal] = useState(initial.legal);
  const [socials, setSocials] = useState(initial.socials);
  const [contact, setContact] = useState(initial.contact);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function patchSettings<K extends keyof FooterSettingsEditInput>(
    key: K,
    value: FooterSettingsEditInput[K],
  ) {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  }
  const dirtySetter =
    <T,>(set: (next: T) => void) =>
    (next: T) => {
      set(next);
      setDirty(true);
    };
  const setColumnsDirty = dirtySetter(setColumns);
  const setLegalDirty = dirtySetter(setLegal);
  const setSocialsDirty = dirtySetter(setSocials);
  const setContactDirty = dirtySetter(setContact);

  const columnsDnd = useReorder(columns, setColumnsDirty);
  const legalDnd = useReorder(legal, setLegalDirty);
  const socialsDnd = useReorder(socials, setSocialsDirty);
  const contactDnd = useReorder(contact, setContactDirty);

  function buildPayload(): FooterEditPayload {
    const cleanColumn = (c: LocalColumn) => ({
      kind: c.kind,
      position: c.position,
      heading: c.heading,
      heading_ar: c.heading_ar,
      is_visible: c.is_visible,
      links: c.links.map(({ uid: _uid, ...rest }) => ({ ...rest })),
    });
    return {
      settings,
      columns: [...columns, ...legal].map(cleanColumn),
      socials: socials.map(({ uid: _uid, ...rest }) => ({ ...rest })),
      contact: contact.map(({ uid: _uid, ...rest }) => ({ ...rest })),
    };
  }

  function save() {
    startTransition(async () => {
      const result = await saveFooter(buildPayload());
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
          {pending ? "Saving…" : "Save footer"}
        </Button>
      </div>

      <Section
        title="Brand & legal"
        description="The paragraph under the wordmark, the Contact heading, and the copyright line — which also feeds the trust strip directly above the footer."
      >
        <div className="grid grid-cols-1 gap-4">
          <label className="flex flex-col gap-1">
            <FieldLabel>Brand blurb</FieldLabel>
            <textarea
              className={cn(fieldCls, "resize-y min-h-[72px] leading-[1.6]")}
              value={settings.blurb ?? ""}
              onChange={(e) => patchSettings("blurb", e.target.value || null)}
            />
            <ArabicTwin
              field={{
                key: "blurb_ar",
                label: "Brand blurb",
                kind: "textarea",
                max: 400,
              }}
              value={settings.blurb_ar ?? ""}
              onChange={(v) => patchSettings("blurb_ar", v || null)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>Contact column heading</FieldLabel>
            <input
              className={fieldCls}
              value={settings.contact_heading ?? ""}
              onChange={(e) =>
                patchSettings("contact_heading", e.target.value || null)
              }
            />
            <ArabicTwin
              field={{
                key: "contact_heading_ar",
                label: "Contact heading",
                kind: "text",
                max: 60,
              }}
              value={settings.contact_heading_ar ?? ""}
              onChange={(v) => patchSettings("contact_heading_ar", v || null)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <FieldLabel>
              Copyright / licence line — shown twice: in the trust strip and in
              the footer&rsquo;s bottom bar
            </FieldLabel>
            <textarea
              className={cn(fieldCls, "resize-y min-h-[56px] leading-[1.6]")}
              value={settings.legal_line ?? ""}
              onChange={(e) =>
                patchSettings("legal_line", e.target.value || null)
              }
            />
            <ArabicTwin
              field={{
                key: "legal_line_ar",
                label: "Copyright line",
                kind: "textarea",
                max: 300,
              }}
              value={settings.legal_line_ar ?? ""}
              onChange={(v) => patchSettings("legal_line_ar", v || null)}
            />
          </label>
        </div>
      </Section>

      <Section
        title="Link columns"
        description="The columns between the brand block and the Contact block. Drag to reorder columns and the links inside them."
      >
        <DndContext
          sensors={columnsDnd.sensors}
          collisionDetection={closestCenter}
          onDragEnd={columnsDnd.onDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.uid)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {columns.map((column, idx) => (
                <ColumnCard
                  key={column.uid}
                  column={column}
                  onChange={(next) => {
                    const arr = columns.slice();
                    arr[idx] = next;
                    setColumnsDirty(arr);
                  }}
                  onRemove={() =>
                    setColumnsDirty(columns.filter((_, i) => i !== idx))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {columns.length < 6 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setColumnsDirty([
                ...columns,
                newLocalColumn(columns.length, "links"),
              ])
            }
          >
            <Plus size={13} strokeWidth={1.8} /> Add column
          </Button>
        ) : (
          <p className="text-[12px] text-bz-muted">
            Six columns is the readable maximum for this layout.
          </p>
        )}
      </Section>

      <Section
        title="Contact entries"
        description="The labelled entries in the Contact column. Phone and email values become tel: / mailto: links automatically."
      >
        <DndContext
          sensors={contactDnd.sensors}
          collisionDetection={closestCenter}
          onDragEnd={contactDnd.onDragEnd}
        >
          <SortableContext
            items={contact.map((c) => c.uid)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2">
              {contact.map((item, idx) => (
                <ContactRow
                  key={item.uid}
                  item={item}
                  onChange={(next) => {
                    const arr = contact.slice();
                    arr[idx] = next;
                    setContactDirty(arr);
                  }}
                  onRemove={() =>
                    setContactDirty(contact.filter((_, i) => i !== idx))
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            setContactDirty([
              ...contact,
              withUid(defaultNewFooterContactItem(contact.length)),
            ])
          }
        >
          <Plus size={13} strokeWidth={1.8} /> Add contact entry
        </Button>
      </Section>

      <Section
        title="Social links"
        description="The pill row under the wordmark. Network names are wordmarks, so they have no Arabic twin — they read the same in both languages."
      >
        <DndContext
          sensors={socialsDnd.sensors}
          collisionDetection={closestCenter}
          onDragEnd={socialsDnd.onDragEnd}
        >
          <SortableContext
            items={socials.map((s) => s.uid)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-1.5">
              {socials.map((social, idx) => (
                <SocialRow
                  key={social.uid}
                  social={social}
                  onChange={(next) => {
                    const arr = socials.slice();
                    arr[idx] = next;
                    setSocialsDirty(arr);
                  }}
                  onRemove={() =>
                    setSocialsDirty(socials.filter((_, i) => i !== idx))
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() =>
            setSocialsDirty([
              ...socials,
              withUid(defaultNewFooterSocial(socials.length)),
            ])
          }
        >
          <Plus size={13} strokeWidth={1.8} /> Add social link
        </Button>
      </Section>

      <Section
        title="Bottom bar"
        description="The small links beside the copyright line. Legal routes and the sitemap; no heading."
      >
        <DndContext
          sensors={legalDnd.sensors}
          collisionDetection={closestCenter}
          onDragEnd={legalDnd.onDragEnd}
        >
          <SortableContext
            items={legal.map((c) => c.uid)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {legal.map((column, idx) => (
                <ColumnCard
                  key={column.uid}
                  column={column}
                  onChange={(next) => {
                    const arr = legal.slice();
                    arr[idx] = next;
                    setLegalDirty(arr);
                  }}
                  onRemove={() =>
                    setLegalDirty(legal.filter((_, i) => i !== idx))
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {legal.length === 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              setLegalDirty([newLocalColumn(0, "legal")])
            }
          >
            <Plus size={13} strokeWidth={1.8} /> Add bottom-bar links
          </Button>
        ) : null}
      </Section>
    </div>
  );
}
