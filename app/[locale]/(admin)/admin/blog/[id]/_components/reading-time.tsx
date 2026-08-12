"use client";

import { readingMinutes, stripHtml } from "@/lib/schemas/article";

/**
 * Sprint 7f (backfilled): word count + reading-time indicator on the
 * blog editor. Pure computation off the current bodyHtml prop.
 */
export function ArticleReadingTime({
  bodyHtml,
}: {
  bodyHtml: string;
}) {
  const words = stripHtml(bodyHtml).split(/\s+/).filter(Boolean).length;
  const minutes = readingMinutes(bodyHtml);
  return (
    <span className="inline-flex items-center gap-3 text-[11.5px] text-bz-muted mono">
      <span>
        <span className="text-bz-ink-2">{words.toLocaleString()}</span>{" "}
        words
      </span>
      <span>
        <span className="text-bz-ink-2">{minutes}</span>{" "}
        min read
      </span>
    </span>
  );
}
