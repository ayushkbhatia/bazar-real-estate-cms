import Link from "next/link";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What this form emails the visitor, stated on the form's own page.
 *
 * The assignment lives in Content assets → Form replies, and that is where it
 * is changed; this exists so nobody has to go looking to find out whether a
 * form even sends one.
 */
export function FormReplyBanner({
  label,
  detail,
  href,
  tone = "default",
}: {
  label: string;
  detail: string;
  href: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-4 py-3 text-[13px]",
        tone === "warn"
          ? "border-[oklch(0.85_0.08_70)] bg-[oklch(0.97_0.03_80)] text-[oklch(0.4_0.08_60)]"
          : "border-bz-border bg-bz-surface text-bz-ink-2",
      )}
    >
      <Mail size={14} strokeWidth={1.8} className="text-bz-muted" />
      <span>
        <span className="text-bz-muted">The visitor receives · </span>
        <strong className="font-medium">{label}</strong>
      </span>
      <span className="text-bz-muted">{detail}</span>
      <Link href={href} className="ms-auto text-bz-ink underline-offset-2 hover:underline">
        Change the reply
      </Link>
    </div>
  );
}
