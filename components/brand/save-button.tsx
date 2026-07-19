"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toggleSavedProperty } from "@/app/(account)/_actions";

type Props = {
  propertyId: string;
  initialSaved: boolean;
  isAuthed: boolean;
  size?: "sm" | "md";
  className?: string;
};

export function SaveButton({
  propertyId,
  initialSaved,
  isAuthed,
  size = "md",
  className,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();

  const dim = size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const icon = size === "sm" ? 14 : 16;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthed) {
      const target = pathname ?? "/";
      router.push(`/sign-in?redirect=${encodeURIComponent(target)}`);
      return;
    }
    startTransition(async () => {
      const optimistic = !saved;
      setSaved(optimistic);
      const result = await toggleSavedProperty(propertyId);
      if (result.status === "ok") {
        setSaved(result.saved);
        toast.success(result.saved ? "Saved." : "Removed from saved.");
      } else if (result.status === "auth_required") {
        setSaved(saved); // revert
        const target = pathname ?? "/";
        router.push(`/sign-in?redirect=${encodeURIComponent(target)}`);
      } else {
        setSaved(saved); // revert
        toast.error(result.message);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save property"}
      className={cn(
        "absolute top-3 right-3 z-10 rounded-full flex items-center justify-center transition-colors",
        dim,
        saved
          ? "bg-bz-accent-soft border border-bz-accent text-bz-accent hover:text-bz-accent-hover"
          : "bg-white/92 text-bz-ink-2 hover:text-bz-accent",
        className,
      )}
    >
      <Heart
        size={icon}
        strokeWidth={1.6}
        className={saved ? "fill-current" : ""}
      />
    </button>
  );
}
