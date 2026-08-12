"use client";

import { Paperclip, Image as ImageIcon, MapPin, Calendar } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 5c (backfilled): composer-footer icon row beneath the
 * concierge text input. Sprint 12 wires real attachment / image / map
 * pin / calendar pickers; today the buttons show a toast explaining the
 * upcoming behaviour.
 */
export function ComposerFooter() {
  function notReady(kind: string) {
    toast.info(
      `${kind} support lands in Sprint 12 alongside the concierge upgrade.`,
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <IconBtn label="Attach file" onClick={() => notReady("Attachment")}>
        <Paperclip size={13} strokeWidth={1.7} />
      </IconBtn>
      <IconBtn label="Send image" onClick={() => notReady("Image")}>
        <ImageIcon size={13} strokeWidth={1.7} />
      </IconBtn>
      <IconBtn label="Share location" onClick={() => notReady("Map pin")}>
        <MapPin size={13} strokeWidth={1.7} />
      </IconBtn>
      <IconBtn label="Schedule" onClick={() => notReady("Calendar")}>
        <Calendar size={13} strokeWidth={1.7} />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-7 h-7 rounded-md text-bz-muted hover:text-bz-ink-2 hover:bg-bz-surface flex items-center justify-center transition-colors"
    >
      {children}
    </button>
  );
}
