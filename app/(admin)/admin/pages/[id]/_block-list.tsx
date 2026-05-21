"use client";

import { useState, useTransition } from "react";
import { ArrowUp, ArrowDown, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  BLOCK_KINDS,
  BLOCK_KIND_LABELS,
  defaultBlockFor,
  type Block,
  type BlockKind,
} from "@/lib/schemas/page";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveBlocks } from "./_actions";

type Props = {
  pageId: string;
  initial: Block[];
};

function BlockSummary({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
      return (
        <span className="truncate">{block.title}</span>
      );
    case "strip":
    case "split":
      return <span className="truncate">{block.heading}</span>;
    case "grid":
      return (
        <span className="truncate">
          {block.heading ?? `Grid · ${block.items.length} items`}
        </span>
      );
    case "banner":
      return <span className="truncate">{block.title}</span>;
  }
}

function HeroEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "hero" }>;
  onChange: (next: Extract<Block, { type: "hero" }>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Eyebrow</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.eyebrow ?? ""}
          onChange={(e) => onChange({ ...block, eyebrow: e.target.value || null })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Title</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Subtitle</span>
        <textarea
          rows={2}
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.subtitle ?? ""}
          onChange={(e) =>
            onChange({ ...block, subtitle: e.target.value || null })
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-bz-muted">CTA label</span>
          <input
            className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
            value={block.cta?.label ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                cta: e.target.value
                  ? { label: e.target.value, href: block.cta?.href ?? "/" }
                  : null,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-bz-muted">CTA href</span>
          <input
            className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
            value={block.cta?.href ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                cta: e.target.value
                  ? { label: block.cta?.label ?? "Browse", href: e.target.value }
                  : null,
              })
            }
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Image placeholder label</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          placeholder="e.g. mamsha · dusk"
          value={block.image?.label ?? ""}
          onChange={(e) =>
            onChange({
              ...block,
              image: e.target.value
                ? { label: e.target.value, media_id: null, alt: null }
                : null,
            })
          }
        />
        <span className="text-[11px] text-bz-muted-2">
          Real-image picker arrives with the media library integration.
        </span>
      </label>
    </div>
  );
}

function StripEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "strip" }>;
  onChange: (next: Extract<Block, { type: "strip" }>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Eyebrow</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.eyebrow ?? ""}
          onChange={(e) =>
            onChange({ ...block, eyebrow: e.target.value || null })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Heading</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.heading}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Body</span>
        <textarea
          rows={4}
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.body ?? ""}
          onChange={(e) =>
            onChange({ ...block, body: e.target.value || null })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Alignment</span>
        <select
          className="bz-field w-fit rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.align}
          onChange={(e) =>
            onChange({ ...block, align: e.target.value as "left" | "center" })
          }
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
        </select>
      </label>
    </div>
  );
}

function SplitEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "split" }>;
  onChange: (next: Extract<Block, { type: "split" }>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Eyebrow</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.eyebrow ?? ""}
          onChange={(e) =>
            onChange({ ...block, eyebrow: e.target.value || null })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Heading</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.heading}
          onChange={(e) => onChange({ ...block, heading: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Body</span>
        <textarea
          rows={4}
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.body ?? ""}
          onChange={(e) =>
            onChange({ ...block, body: e.target.value || null })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Image label</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.image?.label ?? ""}
          onChange={(e) =>
            onChange({
              ...block,
              image: e.target.value
                ? { label: e.target.value, media_id: null, alt: null }
                : null,
            })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Image side</span>
        <select
          className="bz-field w-fit rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.image_side}
          onChange={(e) =>
            onChange({
              ...block,
              image_side: e.target.value as "left" | "right",
            })
          }
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      </label>
    </div>
  );
}

function GridEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "grid" }>;
  onChange: (next: Extract<Block, { type: "grid" }>) => void;
}) {
  const setItem = (
    idx: number,
    next: Partial<Extract<Block, { type: "grid" }>["items"][number]>,
  ) => {
    const items = block.items.map((it, i) => (i === idx ? { ...it, ...next } : it));
    onChange({ ...block, items });
  };

  const addItem = () => {
    if (block.items.length >= 12) return;
    onChange({
      ...block,
      items: [...block.items, { title: "New item", body: null, href: null }],
    });
  };

  const removeItem = (idx: number) => {
    if (block.items.length <= 1) return;
    onChange({
      ...block,
      items: block.items.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Heading (optional)</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.heading ?? ""}
          onChange={(e) =>
            onChange({ ...block, heading: e.target.value || null })
          }
        />
      </label>
      <div className="flex flex-col gap-3">
        {block.items.map((item, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 border border-bz-border rounded p-3 bg-bz-bg"
          >
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] uppercase tracking-widest text-bz-muted-2">
                Item {idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={block.items.length <= 1}
                className="text-[12px] text-bz-muted hover:text-[oklch(0.45_0.13_28)] disabled:opacity-40"
              >
                Remove
              </button>
            </div>
            <input
              className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2 text-[12.5px]"
              placeholder="Title"
              value={item.title}
              onChange={(e) => setItem(idx, { title: e.target.value })}
            />
            <textarea
              rows={2}
              className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2 text-[12.5px]"
              placeholder="Body"
              value={item.body ?? ""}
              onChange={(e) =>
                setItem(idx, { body: e.target.value || null })
              }
            />
            <input
              className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2 text-[12.5px]"
              placeholder="Link href (optional, e.g. /services/buy)"
              value={item.href ?? ""}
              onChange={(e) =>
                setItem(idx, { href: e.target.value || null })
              }
            />
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={addItem}>
        <Plus size={13} strokeWidth={1.8} /> Add item
      </Button>
    </div>
  );
}

function BannerEditor({
  block,
  onChange,
}: {
  block: Extract<Block, { type: "banner" }>;
  onChange: (next: Extract<Block, { type: "banner" }>) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Title</span>
        <input
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Body</span>
        <textarea
          rows={3}
          className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.body ?? ""}
          onChange={(e) =>
            onChange({ ...block, body: e.target.value || null })
          }
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-bz-muted">CTA label</span>
          <input
            className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
            value={block.cta?.label ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                cta: e.target.value
                  ? { label: e.target.value, href: block.cta?.href ?? "/" }
                  : null,
              })
            }
          />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px]">
          <span className="text-bz-muted">CTA href</span>
          <input
            className="bz-field w-full rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
            value={block.cta?.href ?? ""}
            onChange={(e) =>
              onChange({
                ...block,
                cta: e.target.value
                  ? { label: block.cta?.label ?? "Browse", href: e.target.value }
                  : null,
              })
            }
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[12.5px]">
        <span className="text-bz-muted">Variant</span>
        <select
          className="bz-field w-fit rounded border border-bz-border px-2 py-1.5 bg-bz-bg outline-none focus:border-bz-ink-2"
          value={block.variant}
          onChange={(e) =>
            onChange({
              ...block,
              variant: e.target.value as "ink" | "accent" | "soft",
            })
          }
        >
          <option value="ink">Ink</option>
          <option value="accent">Accent</option>
          <option value="soft">Soft</option>
        </select>
      </label>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
}: {
  block: Block;
  onChange: (next: Block) => void;
}) {
  switch (block.type) {
    case "hero":
      return <HeroEditor block={block} onChange={onChange} />;
    case "strip":
      return <StripEditor block={block} onChange={onChange} />;
    case "split":
      return <SplitEditor block={block} onChange={onChange} />;
    case "grid":
      return <GridEditor block={block} onChange={onChange} />;
    case "banner":
      return <BannerEditor block={block} onChange={onChange} />;
  }
}

export function BlockListEditor({ pageId, initial }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const [openIdx, setOpenIdx] = useState<number | null>(
    initial.length > 0 ? 0 : null,
  );
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  function mutate(next: Block[]) {
    setBlocks(next);
    setDirty(true);
  }

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = blocks.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    mutate(next);
    if (openIdx === idx) setOpenIdx(target);
    else if (openIdx === target) setOpenIdx(idx);
  }

  function remove(idx: number) {
    const next = blocks.filter((_, i) => i !== idx);
    mutate(next);
    if (openIdx === idx) setOpenIdx(null);
  }

  function add(kind: BlockKind) {
    const next = [...blocks, defaultBlockFor(kind)];
    mutate(next);
    setOpenIdx(next.length - 1);
  }

  function setBlock(idx: number, next: Block) {
    const arr = blocks.slice();
    arr[idx] = next;
    mutate(arr);
  }

  function save() {
    startTransition(async () => {
      const result = await saveBlocks(pageId, blocks);
      if (result.status === "ok") {
        toast.success(result.message ?? "Saved.");
        setDirty(false);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="bg-bz-surface border border-bz-border rounded-lg p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3
          className="serif text-[20px]"
          style={{ letterSpacing: "-0.015em" }}
        >
          Blocks
        </h3>
        <div className="flex items-center gap-3">
          {dirty ? (
            <span className="text-[11.5px] text-[oklch(0.55_0.18_28)]">
              Unsaved changes
            </span>
          ) : (
            <span className="text-[11.5px] text-bz-muted">All saved</span>
          )}
          <Button onClick={save} disabled={pending || !dirty} size="sm">
            {pending ? "Saving…" : "Save layout"}
          </Button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="text-center py-10 text-bz-muted text-[13px]">
          Empty page. Add your first block below.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((block, idx) => {
            const open = openIdx === idx;
            return (
              <li
                key={`${block.type}-${idx}`}
                className={cn(
                  "border rounded bg-bz-bg",
                  open ? "border-bz-ink" : "border-bz-border",
                )}
              >
                <div
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                  onClick={() => setOpenIdx(open ? null : idx)}
                >
                  <span className="text-[11px] uppercase tracking-widest text-bz-muted-2 w-[60px]">
                    {BLOCK_KIND_LABELS[block.type]}
                  </span>
                  <span className="text-[13px] flex-1 truncate">
                    <BlockSummary block={block} />
                  </span>
                  <div className="flex gap-1 text-bz-muted">
                    <button
                      type="button"
                      aria-label="Move up"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(idx, -1);
                      }}
                      disabled={idx === 0}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-bz-surface-2 disabled:opacity-30"
                    >
                      <ArrowUp size={13} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      onClick={(e) => {
                        e.stopPropagation();
                        move(idx, 1);
                      }}
                      disabled={idx === blocks.length - 1}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-bz-surface-2 disabled:opacity-30"
                    >
                      <ArrowDown size={13} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete block"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Remove this block?")) remove(idx);
                      }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-bz-surface-2 hover:text-[oklch(0.45_0.13_28)]"
                    >
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
                {open ? (
                  <div className="px-4 py-4 border-t border-bz-border">
                    <BlockEditor
                      block={block}
                      onChange={(next) => setBlock(idx, next)}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-bz-border pt-4 flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] text-bz-muted mr-1">Add block:</span>
        {BLOCK_KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => add(kind)}
          >
            + {BLOCK_KIND_LABELS[kind]}
          </Button>
        ))}
      </div>
    </div>
  );
}
