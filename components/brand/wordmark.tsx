import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
};

const sizeMap = {
  sm: "text-[18px]",
  md: "text-[22px]",
  lg: "text-[28px]",
};

export function Wordmark({
  className,
  sublabel = "Abu Dhabi",
  size = "md",
}: WordmarkProps) {
  return (
    <div className={cn("flex items-baseline gap-1.5", className)}>
      <span
        className={cn(
          "serif italic font-normal tracking-tight leading-none",
          sizeMap[size],
        )}
      >
        Bazar
      </span>
      {sublabel ? (
        <span className="text-[12px] text-bz-muted tracking-wider leading-none">
          · {sublabel}
        </span>
      ) : null}
    </div>
  );
}
