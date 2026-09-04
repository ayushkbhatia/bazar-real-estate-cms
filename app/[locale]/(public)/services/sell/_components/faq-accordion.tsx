"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** [question, answer][] */
  items: [string, string][];
};

/**
 * Single-open accordion — the first item is open on load, and clicking the
 * open item closes it. Not `<details>`: the design's one-at-a-time behaviour
 * needs shared state, so the disclosure semantics are wired by hand instead
 * (aria-expanded / aria-controls on the header, labelled region below).
 */
export function FaqAccordion({ items }: Props) {
  const baseId = useId();
  const [open, setOpen] = useState(0);

  return (
    <div>
      {items.map(([question, answer], i) => {
        const isOpen = open === i;
        const headerId = `${baseId}-h-${i}`;
        const panelId = `${baseId}-p-${i}`;
        return (
          <div
            key={question}
            className={cn(
              "border-b border-bz-border",
              i === 0 ? "border-t" : undefined,
            )}
          >
            <h3>
              <button
                type="button"
                id={headerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full flex items-center gap-5 py-5 md:py-[22px] text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bz-teal"
              >
                <span
                  className="flex-1 text-[15.5px] md:text-[17px] text-bz-ink"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {question}
                </span>
                <ChevronDown
                  size={18}
                  strokeWidth={1.6}
                  className={cn(
                    "shrink-0 text-bz-muted transition-transform duration-150",
                    isOpen ? "rotate-180" : undefined,
                  )}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              hidden={!isOpen}
              className="text-[14.5px] text-bz-ink-2 leading-[1.7] pb-6 md:pe-[60px] max-w-[720px]"
            >
              {answer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
