"use client";

/**
 * Floating contact rail — one mount, every public page.
 *
 * Desktop: fixed column at the bottom-right, fading in once the visitor has
 *          scrolled past the hero.
 * Mobile:  a dock that slides up from the bottom edge at the same point.
 *
 * Everything visible here comes from the `floating_ctas` table, edited at
 * /admin/floating-ctas: the button text, the number or address behind it, the
 * draft message it opens with, the fill colour, and whether it floats
 * site-wide or only on pages that name an advisor.
 *
 * Advisor routing still works: a detail page publishes its advisor through
 * `<FloatingCtaTarget>` (see floating-cta-context.tsx) and any CTA with
 * `use_advisor_contact` prefers that person's number / address over the
 * firm-wide one.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import {
  readableForeground,
  renderCtaTemplate,
  type FloatingCtaKind,
} from "@/lib/schemas/floating-cta";
import type { FloatingCtaRow } from "@/lib/queries/floating-ctas";
import {
  useFloatingCtaTarget,
  type FloatingCtaTargetValue,
} from "./floating-cta-context";

/** Scroll distance the rail waits for on a page long enough to allow it. */
const REVEAL_AT = 480;

const ICONS: Record<FloatingCtaKind, typeof Phone> = {
  whatsapp: MessageCircle,
  call: Phone,
  email: Mail,
};

type ResolvedCta = {
  id: string;
  kind: FloatingCtaKind;
  label: string;
  href: string;
  external: boolean;
  ariaLabel: string;
  color: string | null;
};

export function FloatingCtaRail({
  ctas,
  fallbackPhone,
}: {
  ctas: FloatingCtaRow[];
  /** NEXT_PUBLIC_WHATSAPP_ADVISOR_NUMBER, resolved server-side. */
  fallbackPhone: string | null;
}) {
  const target = useFloatingCtaTarget();
  const visible = useRevealOnScroll();
  const page = usePageIdentity();

  const resolved = useMemo(
    () =>
      ctas
        .filter((cta) => cta.scope === "all_pages" || target !== null)
        .map((cta) => resolve(cta, target, fallbackPhone, page))
        .filter((cta): cta is ResolvedCta => cta !== null),
    [ctas, target, fallbackPhone, page],
  );

  if (resolved.length === 0) return null;

  return (
    <>
      {/* Desktop column */}
      <div
        className={`hidden md:flex fixed end-4 bottom-6 z-40 flex-col gap-2 transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {resolved.map((cta) => (
          <CtaLink key={cta.id} cta={cta} />
        ))}
      </div>

      {/*
        Mobile dock. The buttons float directly over the page rather than
        inside a tray: a dark `bg-bz-ink/95` wrapper used to sit behind them,
        which read as a thick black border around the one tinted button and
        made the untinted ones look like part of the bar instead of buttons
        of their own. Each pill now carries its own fill and shadow, exactly
        as on desktop.
      */}
      <div
        className={`md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-2 pb-bar-safe transition-transform ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex gap-2">
          {resolved.map((cta) => (
            <CtaLink key={cta.id} cta={cta} compact />
          ))}
        </div>
      </div>
    </>
  );
}

function CtaLink({ cta, compact }: { cta: ResolvedCta; compact?: boolean }) {
  const Icon = ICONS[cta.kind];
  // A custom fill owns both colours: the foreground is derived from the fill's
  // luminance so an editor picking any hex still gets readable text.
  const style = cta.color
    ? { backgroundColor: cta.color, color: readableForeground(cta.color) }
    : undefined;

  // Mobile shares one row, so every button takes an equal share of it and the
  // set reads as one control. Both variants are h-11 and both carry a border —
  // transparent on a tinted fill — so a green pill and a plain one are the
  // same box to the pixel rather than differing by the border's two pixels.
  const base = compact
    ? "flex-1 min-w-0 justify-center gap-1.5 h-11 px-2 text-[12.5px] shadow-lg"
    : "gap-2 h-11 px-4 text-[13px] shadow-md";
  const fill = cta.color
    ? "border-transparent hover:opacity-90"
    : "bg-bz-surface border-bz-border hover:bg-bz-surface-2 text-bz-ink";

  return (
    <a
      href={cta.href}
      {...(cta.external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : null)}
      className={`flex items-center rounded-full border ${base} ${fill}`}
      style={style}
      aria-label={cta.ariaLabel}
    >
      <Icon size={compact ? 14 : 15} strokeWidth={1.8} className="shrink-0" />
      <span className="truncate">{cta.label}</span>
    </a>
  );
}

// ───────────────────────────────────────────────────────────────
// Resolution
// ───────────────────────────────────────────────────────────────

type PageIdentity = { title: string; url: string };

function resolve(
  cta: FloatingCtaRow,
  target: FloatingCtaTargetValue | null,
  fallbackPhone: string | null,
  page: PageIdentity,
): ResolvedCta | null {
  const advisorName = target?.advisorName ?? null;
  const useAdvisor = cta.use_advisor_contact && target !== null;
  const templateCtx = {
    advisorName,
    // Off a detail page the page's own title is the best answer to "what are
    // you enquiring about" — it is what the visitor is looking at.
    contextRef: target?.contextRef ?? page.title,
    url: page.url,
  };
  const message = renderCtaTemplate(cta.message_template, templateCtx);
  const who = advisorName ?? cta.label;

  if (cta.kind === "email") {
    const address =
      (useAdvisor ? target?.advisorEmail : null) ?? cta.destination ?? null;
    if (!address?.trim()) return null;
    const params = new URLSearchParams();
    const subject = renderCtaTemplate(cta.subject_template, templateCtx);
    if (subject) params.set("subject", subject);
    if (message) params.set("body", message);
    const query = params.toString();
    return {
      id: cta.id,
      kind: cta.kind,
      label: cta.label,
      // URLSearchParams encodes spaces as "+", which mail clients paste
      // literally into the subject line. %20 is what mailto: wants.
      href: `mailto:${address.trim()}${query ? `?${query.replace(/\+/g, "%20")}` : ""}`,
      external: false,
      ariaLabel: `Email ${who}`,
      color: cta.color,
    };
  }

  const number =
    (useAdvisor ? target?.advisorPhone : null) ??
    cta.destination ??
    fallbackPhone;
  if (!number?.trim()) return null;

  if (cta.kind === "whatsapp") {
    const href = buildWhatsAppLink(number, message);
    if (!href) return null;
    return {
      id: cta.id,
      kind: cta.kind,
      label: cta.label,
      href,
      external: true,
      ariaLabel: `Message ${who} on WhatsApp`,
      color: cta.color,
    };
  }

  return {
    id: cta.id,
    kind: cta.kind,
    label: cta.label,
    href: `tel:${number.replace(/[^\d+]/g, "")}`,
    external: false,
    ariaLabel: `Call ${who}`,
    color: cta.color,
  };
}

// ───────────────────────────────────────────────────────────────
// Hooks
// ───────────────────────────────────────────────────────────────

/**
 * Reveal on scroll, without stranding the rail on short pages.
 *
 * The original rail waited for a flat 480px, which was right for a listing
 * page and wrong for `/legal/cookies`, where the document never scrolls that
 * far and the button would never appear. The threshold is now 480px *or* 40%
 * of whatever scroll the page actually has, whichever is less — identical on
 * anything tall, and immediate on a page that doesn't scroll at all.
 */
function useRevealOnScroll(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function evaluate() {
      const scrollable = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const threshold = Math.min(REVEAL_AT, scrollable * 0.4);
      setVisible(window.scrollY >= threshold);
    }
    evaluate();
    window.addEventListener("scroll", evaluate, { passive: true });
    window.addEventListener("resize", evaluate);
    return () => {
      window.removeEventListener("scroll", evaluate);
      window.removeEventListener("resize", evaluate);
    };
  }, []);

  return visible;
}

/**
 * The current page's title and URL, for {context} and {url}.
 *
 * Read after mount rather than during render: `document` doesn't exist on the
 * server, and the rail is invisible until the first scroll event anyway, so
 * there is nothing to flash. The title is trimmed at its first separator to
 * drop the " | Bazar" suffix the metadata template appends.
 *
 * A client navigation changes the pathname first and the title a beat later,
 * and Next replaces the whole `<title>` element rather than editing its text —
 * so neither signal alone is enough. The pathname re-runs the effect; a
 * `document.head` observer catches the title landing afterwards.
 */
function usePageIdentity(): PageIdentity {
  const pathname = usePathname();
  const [page, setPage] = useState<PageIdentity>({ title: "", url: "" });

  useEffect(() => {
    function read() {
      const next = {
        title: (document.title.split(/\s+[|·—–]\s+/)[0] ?? "").trim(),
        url: window.location.href,
      };
      setPage((current) =>
        current.title === next.title && current.url === next.url
          ? current
          : next,
      );
    }
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return page;
}
