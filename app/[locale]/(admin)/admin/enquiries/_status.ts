import type { Database } from "@/db/types";

type EnquiryStatus = Database["public"]["Enums"]["enquiry_status"];

/** One vocabulary for a lead's stage, shared by the inbox and the history card. */
export const STATUS_LABELS: Record<EnquiryStatus, string> = {
  new: "New",
  qualified: "Qualified",
  offer: "Offer",
  closed_won: "Won",
  closed_lost: "Lost",
};

export const STATUS_STYLES: Record<EnquiryStatus, string> = {
  new: "bg-[oklch(0.96_0.05_240)] text-[oklch(0.45_0.1_240)]",
  qualified: "bg-bz-accent-soft text-bz-accent",
  offer: "bg-bz-surface-2 text-bz-ink-2",
  closed_won: "bg-[oklch(0.94_0.04_145)] text-[oklch(0.35_0.08_145)]",
  closed_lost: "bg-[oklch(0.96_0.04_28)] text-[oklch(0.45_0.13_28)]",
};
