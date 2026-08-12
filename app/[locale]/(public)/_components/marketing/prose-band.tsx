import { cn } from "@/lib/utils";
import { SectionHead } from "./section-head";

type Props = {
  eyebrow?: string | null;
  title?: string | null;
  body: string;
  align?: "left" | "center";
  tone?: "bg" | "surface";
};

/**
 * A run of prose.
 *
 * Paragraphs come from blank lines in the textarea rather than from a rich-text
 * editor: a landing page wants a couple of paragraphs, and the alternative is a
 * second HTML sanitiser and a second editor toolbar to maintain. The `62ch`
 * measure is the same one the FAQ and block renderers use.
 */
export function ProseBand({
  eyebrow,
  title,
  body,
  align = "left",
  tone = "bg",
}: Props) {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length === 0 && !title) return null;

  return (
    <section
      className={cn(
        "px-4 md:px-12 py-12 md:py-20",
        tone === "surface" && "bg-bz-surface-2",
      )}
    >
      <div
        className={cn(
          "max-w-[1200px]",
          align === "center" && "mx-auto text-center",
        )}
      >
        {title || eyebrow ? (
          <SectionHead
            eyebrow={eyebrow ?? undefined}
            title={title ?? undefined}
            align={align}
            className="mb-6"
          />
        ) : null}
        <div
          className={cn(
            "flex flex-col gap-4 text-[15px] md:text-[16px] leading-[1.7] text-bz-ink-2 max-w-[62ch]",
            align === "center" && "mx-auto",
          )}
        >
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}
