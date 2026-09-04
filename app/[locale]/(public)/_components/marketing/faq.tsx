import { Plus } from "lucide-react";

type Props = {
  /** [question, answer][] */
  items: [string, string][];
};

/**
 * Numbered Q/A list. Uses native <details>/<summary> so it stays keyboard- and
 * screen-reader-accessible with no client JS (the handoff's `FAQ`).
 */
export function Faq({ items }: Props) {
  return (
    <div className="border-t border-bz-border">
      {items.map(([q, a], i) => (
        <details
          key={q}
          className="group border-b border-bz-border py-6 md:py-7"
        >
          <summary className="flex items-start gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="mono text-[12px] text-bz-accent pt-1 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className="serif serif-body flex-1 text-bz-ink"
              style={{
                fontSize: "clamp(18px, 2.2vw, 22px)",
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
              }}
            >
              {q}
            </span>
            <Plus
              size={18}
              strokeWidth={1.6}
              className="mt-1 shrink-0 text-bz-muted transition-transform group-open:rotate-45"
            />
          </summary>
          <p className="text-[15px] text-bz-ink-2 leading-[1.6] mt-3 md:ps-[calc(12px+1rem)] md:max-w-[62ch]">
            {a}
          </p>
        </details>
      ))}
    </div>
  );
}
