import { cn } from "@/lib/utils";

type Props = {
  /** [title, description][] */
  steps: [string, string][];
  className?: string;
};

/**
 * Numbered "how we support you" step list. Responsive: single column on mobile,
 * two columns on desktop (the handoff's `StepFlow`).
 */
export function StepFlow({ steps, className }: Props) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 border-t border-bz-border",
        className,
      )}
    >
      {steps.map(([t, d], i) => (
        <div
          key={t}
          className="py-6 pr-6 border-b border-bz-border md:[&:nth-child(odd)]:border-r md:[&:nth-child(odd)]:pr-6 md:[&:nth-child(even)]:pl-6"
        >
          <div className="flex items-center gap-2.5">
            <span className="mono text-[11px] text-bz-accent">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-[15px] font-semibold">{t}</span>
          </div>
          <p className="text-[13px] text-bz-muted leading-[1.55] mt-2">{d}</p>
        </div>
      ))}
    </div>
  );
}
