import Link from "next/link";
import { ArrowRight, Heart, Search } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 6 (backfilled): 320px left rail on /account/saved with a
 * summary of saved searches and quick-jump shortcuts to alerts.
 */
export function SavedLeftRail({
  savedPropertyCount,
  savedSearchCount,
  hottestSearchName,
}: {
  savedPropertyCount: number;
  savedSearchCount: number;
  hottestSearchName: string | null;
}) {
  return (
    <aside className="w-[320px] flex-shrink-0 sticky top-6 self-start">
      <div className="rounded-lg border border-bz-border bg-bz-surface p-5">
        <Eyebrow>Summary</Eyebrow>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat
            icon={<Heart size={14} strokeWidth={1.7} />}
            label="Saved"
            value={savedPropertyCount}
          />
          <Stat
            icon={<Search size={14} strokeWidth={1.7} />}
            label="Searches"
            value={savedSearchCount}
          />
        </div>
        {hottestSearchName ? (
          <div className="mt-4 pt-4 border-t border-bz-border">
            <div className="text-[11px] uppercase tracking-wider text-bz-muted">
              Most active search
            </div>
            <div className="text-[13.5px] mt-1 text-bz-ink font-medium truncate">
              {hottestSearchName}
            </div>
          </div>
        ) : null}
        <Link
          href="/account/alerts"
          className="mt-5 inline-flex items-center gap-1.5 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors"
        >
          Manage alerts
          <ArrowRight size={12} strokeWidth={1.7} />
        </Link>
      </div>
    </aside>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-bz-muted">{icon}</span>
      <span
        className="serif text-[26px] leading-none"
        style={{ letterSpacing: "-0.018em" }}
      >
        {value}
      </span>
      <span className="text-[11.5px] text-bz-muted">{label}</span>
    </div>
  );
}
