import { cn } from "@/lib/utils";

type PlaceholderImageProps = {
  label?: string;
  dark?: boolean;
  className?: string;
  children?: React.ReactNode;
};

/**
 * Striped placeholder used until real photography lands.
 * Mirrors the `bz-img` pattern from design-references/styles.css.
 */
export function PlaceholderImage({
  label = "image",
  dark,
  className,
  children,
}: PlaceholderImageProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden flex items-center justify-center",
        dark ? "bz-img-dark text-bz-muted-2" : "bz-img text-bz-muted",
        className,
      )}
    >
      <span
        className={cn(
          "mono text-[10.5px] uppercase tracking-wide px-2 py-0.5 rounded-sm",
          dark ? "bg-black/40 text-white/85" : "bg-white/70 text-bz-muted",
        )}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
