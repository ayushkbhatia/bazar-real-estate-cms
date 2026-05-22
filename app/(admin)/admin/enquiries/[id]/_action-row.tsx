"use client";

import { Phone, MessageCircle, Calendar } from "lucide-react";
import { toast } from "sonner";

/**
 * Sprint 7e (backfilled): Call / WhatsApp / Book viewing action row
 * pinned at the top of the conversation pane on the enquiry detail.
 */
export function EnquiryActionRow({
  phone,
  name,
  propertyReference,
  onBookViewing,
}: {
  phone: string | null;
  name: string;
  propertyReference: string | null;
  onBookViewing?: () => void;
}) {
  const callHref = phone ? `tel:${phone.replace(/\s/g, "")}` : null;
  const wa = phone
    ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hi ${name.split(" ")[0]}, this is Bazar — following up on your enquiry${
          propertyReference ? ` for ${propertyReference}` : ""
        }.`,
      )}`
    : null;

  function bookViewing() {
    if (onBookViewing) onBookViewing();
    else
      toast.info(
        "Book viewing wires to the existing schedule form (see context pane).",
      );
  }

  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-bz-border bg-bz-surface">
      <a
        href={callHref ?? "#"}
        onClick={(e) => {
          if (!callHref) {
            e.preventDefault();
            toast.info("No phone number on file.");
          }
        }}
        className={
          callHref
            ? "inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bz-ink text-bz-bg text-[12.5px] font-medium hover:bg-bz-ink-2 transition-colors"
            : "inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-bz-surface-2 text-bz-muted text-[12.5px]"
        }
      >
        <Phone size={12} strokeWidth={1.8} />
        Call
      </a>
      <a
        href={wa ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!wa) {
            e.preventDefault();
            toast.info("No phone number on file.");
          }
        }}
        className={
          wa
            ? "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
            : "inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12.5px] text-bz-muted"
        }
      >
        <MessageCircle size={12} strokeWidth={1.7} />
        WhatsApp
      </a>
      <button
        type="button"
        onClick={bookViewing}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-bz-border bg-bz-bg text-[12.5px] text-bz-ink-2 hover:border-bz-border-strong transition-colors"
      >
        <Calendar size={12} strokeWidth={1.7} />
        Book viewing
      </button>
    </div>
  );
}
