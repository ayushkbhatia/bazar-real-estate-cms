"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/brand/mobile";
import { BLOCK_GROUPS, blocksInGroup } from "@/lib/page-builder/catalogue";
import type { BlockDef } from "@/lib/page-builder/types";

/**
 * The catalogue picker.
 *
 * A bottom sheet rather than a dialog because it is the one control an editor
 * touches on every page, and this screen is expected to work on a phone. The
 * sheet is the shared mobile primitive, so it already carries the safe-area
 * padding and the focus trap.
 */
export function AddBlock({
  usedTypes,
  onAdd,
}: {
  /** Types already on the page, so singletons can be hidden. */
  usedTypes: string[];
  onAdd: (def: BlockDef) => void;
}) {
  const [open, setOpen] = useState(false);
  const used = new Set(usedTypes);

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      title="Add a section"
      description="Every section here already ships on the live site, so it looks right on a phone out of the box."
      maxHeight="88dvh"
      trigger={
        <Button type="button" variant="outline" size="sm" className="self-start">
          <Plus size={13} strokeWidth={1.8} /> Add section
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pb-4">
        {BLOCK_GROUPS.map((group) => {
          const defs = blocksInGroup(group.key).filter(
            (d) => !(d.singleton && used.has(d.key)),
          );
          if (defs.length === 0) return null;
          return (
            <section key={group.key} className="flex flex-col gap-2">
              <div>
                <h3 className="text-[12.5px] font-medium">{group.label}</h3>
                <p className="text-[11px] text-bz-muted-2">{group.blurb}</p>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 [&>*]:min-w-0">
                {defs.map((def) => (
                  <li key={def.key}>
                    <button
                      type="button"
                      onClick={() => {
                        onAdd(def);
                        setOpen(false);
                      }}
                      className="w-full h-full text-start rounded-lg border border-bz-border bg-bz-surface hover:border-bz-teal transition-colors px-3.5 py-3"
                    >
                      <span className="text-[13px] font-medium">
                        {def.label}
                      </span>
                      <span className="block text-[11.5px] text-bz-muted mt-0.5">
                        {def.description}
                      </span>
                      {def.dataNote ? (
                        <span className="mt-2 block rounded bg-bz-surface-2 px-2 py-1.5 text-[10.5px] text-bz-muted">
                          {def.dataNote}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </BottomSheet>
  );
}
