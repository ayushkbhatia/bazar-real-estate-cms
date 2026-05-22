"use client";

import { useState } from "react";
import { Plus, Check, X } from "lucide-react";

/**
 * Sprint 5c (backfilled): "Add" button on the brief-chip rail. Lets
 * users manually add a constraint that the LLM hasn't inferred yet.
 */
export function AddChip({
  onAdd,
}: {
  onAdd: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  function commit() {
    const trimmed = value.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    onAdd(trimmed);
    setValue("");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-bz-surface border border-bz-border h-7 pl-2.5 pr-0.5">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          placeholder="Beachfront, 3-bed, …"
          className="bg-transparent outline-none text-[11.5px] text-bz-ink min-w-[160px] placeholder:text-bz-muted"
        />
        <button
          type="button"
          onClick={commit}
          aria-label="Add chip"
          className="w-6 h-6 rounded-full bg-bz-ink text-bz-bg flex items-center justify-center"
        >
          <Check size={11} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue("");
            setEditing(false);
          }}
          aria-label="Cancel"
          className="w-6 h-6 rounded-full text-bz-muted hover:text-bz-ink flex items-center justify-center"
        >
          <X size={11} strokeWidth={2} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-bz-bg border border-dashed border-bz-border text-[11.5px] text-bz-muted hover:text-bz-ink-2 hover:border-bz-border-strong transition-colors"
    >
      <Plus size={11} strokeWidth={1.8} />
      Add chip
    </button>
  );
}
