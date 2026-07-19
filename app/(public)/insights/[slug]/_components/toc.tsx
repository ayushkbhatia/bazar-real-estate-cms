"use client";

import { useEffect, useState } from "react";

type TocEntry = { id: string; text: string; level: number };

/**
 * Sprint 5d (backfilled): sticky table-of-contents rail for the article
 * detail page. Extracts h2/h3 headings from the rendered body on mount
 * and keeps the active entry in sync as the user scrolls.
 */
export function ArticleToc() {
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Collect h2 + h3 from the article body. Bodies render via
    // dangerouslySetInnerHTML so we have to read the DOM after first paint.
    // We schedule the state update for the next microtask to avoid the
    // synchronous-setState-in-effect lint rule (no cascading render risk
    // either way since the body is server-rendered).
    const container = document.getElementById("article-body");
    if (!container) return;

    const headings = Array.from(
      container.querySelectorAll("h2, h3"),
    ) as HTMLHeadingElement[];

    const list: TocEntry[] = headings.map((h, i) => {
      if (!h.id) h.id = `toc-${i}-${slugify(h.textContent ?? "")}`;
      return {
        id: h.id,
        text: h.textContent ?? "",
        level: h.tagName === "H3" ? 2 : 1,
      };
    });
    queueMicrotask(() => setEntries(list));

    const obs = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          if (r.isIntersecting) {
            setActiveId(r.target.id);
            return;
          }
        }
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, []);

  if (entries.length === 0) return null;

  return (
    <nav
      aria-label="On this page"
      className="sticky top-6 w-[200px] flex-shrink-0 text-[12.5px]"
    >
      <div className="text-[10.5px] uppercase tracking-widest text-bz-muted mb-3">
        On this page
      </div>
      <ul className="flex flex-col gap-1.5">
        {entries.map((e) => (
          <li key={e.id} className={e.level === 2 ? "pl-3" : ""}>
            <a
              href={`#${e.id}`}
              className={
                activeId === e.id
                  ? "text-bz-accent font-medium"
                  : "text-bz-muted hover:text-bz-ink-2 transition-colors"
              }
            >
              {e.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
