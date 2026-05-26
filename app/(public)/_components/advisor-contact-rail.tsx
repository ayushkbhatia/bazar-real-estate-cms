"use client";

/**
 * T2-D: floating advisor-contact rail.
 *
 * Mobile: fixed bottom strip with WhatsApp + call buttons.
 * Desktop: sticky right-edge rail that fades in once the user scrolls past
 *          the hero (so it doesn't compete with the inline advisor card).
 *
 * Composes alongside `<AgentCard>` rather than replacing it — the inline
 * card carries the advisor's photo + intro; this rail is the 1-tap action
 * shortcut once the user has scrolled away from it.
 */

import { useEffect, useState } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";

type Props = {
  /** Advisor display name, used in the WhatsApp message prefix. */
  advisorName: string;
  /** Advisor phone (E.164 or any format normaliseNumber can clean). */
  advisorPhone: string | null;
  /** Listing reference / development name, embedded in the prefilled
   *  WhatsApp message so the advisor sees the context immediately. */
  contextRef: string;
  /** "property" or "development" — slightly tweaks the message wording. */
  kind: "property" | "development";
};

export function AdvisorContactRail({
  advisorName,
  advisorPhone,
  contextRef,
  kind,
}: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      // Fade in past the hero — 480px is a reasonable single-fold proxy.
      setVisible(window.scrollY > 480);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const messagePrefix =
    kind === "property"
      ? `Hi ${advisorName}, I'm interested in ${contextRef} on bazar.ae`
      : `Hi ${advisorName}, I'm looking at ${contextRef} on bazar.ae`;
  const waUrl = buildWhatsAppLink(advisorPhone, messagePrefix);
  const telUrl = advisorPhone ? `tel:${advisorPhone.replace(/\s+/g, "")}` : null;

  // Hide entirely if there's nothing to link to.
  if (!waUrl && !telUrl) return null;

  return (
    <>
      {/* Desktop sticky rail */}
      <div
        className={`hidden md:flex fixed right-4 bottom-6 z-40 flex-col gap-2 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {waUrl ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 h-11 px-4 rounded-full bg-bz-ink text-bz-bg shadow-lg hover:bg-bz-ink/90 text-[13px]"
            aria-label={`Message ${advisorName} on WhatsApp`}
          >
            <MessageCircle size={15} strokeWidth={1.8} />
            <span>WhatsApp {advisorName.split(" ")[0]}</span>
          </a>
        ) : null}
        {telUrl ? (
          <a
            href={telUrl}
            className="flex items-center gap-2 h-11 px-4 rounded-full bg-bz-surface border border-bz-border shadow-md hover:bg-bz-surface-2 text-bz-ink text-[13px]"
            aria-label={`Call ${advisorName}`}
          >
            <Phone size={15} strokeWidth={1.8} />
            <span>Call</span>
          </a>
        ) : null}
      </div>

      {/* Mobile bottom dock — slides up past the fold */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2 transition-transform ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex gap-2 rounded-full bg-bz-ink/95 text-bz-bg p-1.5 shadow-xl backdrop-blur">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full bg-white/10 text-bz-bg hover:bg-white/20 text-[13px]"
              aria-label={`Message ${advisorName} on WhatsApp`}
            >
              <MessageCircle size={14} strokeWidth={1.8} />
              <span>WhatsApp</span>
            </a>
          ) : null}
          {telUrl ? (
            <a
              href={telUrl}
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-full bg-white/10 text-bz-bg hover:bg-white/20 text-[13px]"
              aria-label={`Call ${advisorName}`}
            >
              <Phone size={14} strokeWidth={1.8} />
              <span>Call</span>
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}
