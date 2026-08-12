"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 7f (backfilled): tag chips on the blog editor.
 * `articles.tags` lives in the existing schema (text[]); Sprint 9 wires
 * the update action through this onChange callback.
 */
export function ArticleTagsChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (!t) return;
    if (value.includes(t)) {
      setInput("");
      return;
    }
    onChange([...value, t]);
    setInput("");
  }

  function remove(t: string) {
    onChange(value.filter((v) => v !== t));
  }

  return (
    <div>
      <Eyebrow>Tags</Eyebrow>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-bz-surface border border-bz-border text-[12px] text-bz-ink"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove ${t}`}
              className="text-bz-muted hover:text-bz-danger"
            >
              <X size={10} strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-dashed border-bz-border bg-bz-bg h-7 ps-2.5 pe-0.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add tag…"
          className="bg-transparent outline-none text-[12px] text-bz-ink min-w-[120px] placeholder:text-bz-muted"
        />
        <button
          type="button"
          onClick={add}
          aria-label="Add tag"
          className="w-6 h-6 rounded-full bg-bz-ink text-bz-bg flex items-center justify-center"
        >
          <Plus size={11} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
