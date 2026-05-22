"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FolderOpen,
  Image as ImageIcon,
  Building2,
  Newspaper,
  Users,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FOLDERS = [
  { value: "all", label: "All media", icon: FolderOpen },
  { value: "listings", label: "By listing", icon: Building2 },
  { value: "brand", label: "Brand", icon: ImageIcon },
  { value: "blog", label: "Blog", icon: Newspaper },
  { value: "team", label: "Team", icon: Users },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "trash", label: "Trash", icon: Trash2 },
] as const;

/**
 * Sprint 7d (backfilled): 220px folder rail on /admin/media.
 * Reads URL state `?folder=…` and applies counts passed from the parent.
 */
export function MediaFolderRail({
  counts,
}: {
  counts: Record<string, number>;
}) {
  const sp = useSearchParams();
  const active = sp.get("folder") ?? "all";

  return (
    <nav className="w-[220px] flex-shrink-0 flex flex-col gap-0.5">
      <div className="px-3 pb-2 text-[10.5px] uppercase tracking-widest text-bz-muted-2">
        Folders
      </div>
      {FOLDERS.map((f) => {
        const isActive = active === f.value;
        const Icon = f.icon;
        const params = new URLSearchParams(sp.toString());
        if (f.value === "all") params.delete("folder");
        else params.set("folder", f.value);
        const qs = params.toString();
        return (
          <Link
            key={f.value}
            href={qs ? `?${qs}` : "?"}
            className={cn(
              "flex items-center justify-between px-3 py-2 rounded text-[13px] transition-colors",
              isActive
                ? "bg-bz-ink text-bz-bg"
                : "text-bz-ink-2 hover:bg-bz-surface-2",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Icon size={13} strokeWidth={1.6} />
              {f.label}
            </span>
            <span
              className={cn(
                "mono text-[10.5px]",
                isActive ? "text-bz-bg/80" : "text-bz-muted",
              )}
            >
              {counts[f.value] ?? 0}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
