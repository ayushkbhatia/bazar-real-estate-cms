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
  BRAND_NAME,
  readableForeground,
  renderCtaTemplate,
  type FloatingCtaKind,
  type FloatingCtaTokenValues,
} from "@/lib/schemas/floating-cta";
import type { FloatingCtaRow } from "@/lib/queries/floating-ctas";
import {
  useFloatingCtaTarget,
  type FloatingCtaTargetValue,
} from "./floating-cta-context";

/** Where a click is recorded. See app/api/cta-click/route.ts. */
const CLICK_ENDPOINT = "/api/cta-click";

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
  /** Everything `POST /api/cta-click` records. Never rendered. */
  log: ClickLog;
};

type ClickLog = {
  cta_id: string;
  cta_key: string;
  kind: FloatingCtaKind;
  destination: string;
  /** Whose contact details this resolved to, which is what the office asks. */
  source: "advisor" | "cta" | "fallback";
  advisor_id: string | null;
  advisor_name: string | null;
  property_id: string | null;
  development_id: string | null;
  context_ref: string | null;
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
          <CtaLink key={cta.id} cta={cta} page={page} />
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
            <CtaLink key={cta.id} cta={cta} page={page} compact />
          ))}
        </div>
      </div>
    </>
  );
}

function CtaLink({
  cta,
  compact,
  page,
}: {
  cta: ResolvedCta;
  compact?: boolean;
  page: PageIdentity;
}) {
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
      onClick={() => recordClick(cta, page)}
    >
      <Icon size={compact ? 14 : 15} strokeWidth={1.8} className="shrink-0" />
      <span className="truncate">{cta.label}</span>
    </a>
  );
}

/**
 * Tell the server the button was pressed, then get out of the way.
 *
 * A `wa.me` link opens a chat inside the visitor's own WhatsApp and a
 * `mailto:` hands a draft to their mail client — neither ever reaches Bazar,
 * so this beacon is the only record that the enquiry happened. It is
 * deliberately not awaited and never blocks the navigation: a listing enquiry
 * must not be lost because analytics was slow, and a failed log is worth less
 * than the click it would have cost.
 *
 * `sendBeacon` survives the page being torn down by the outbound navigation,
 * which a plain fetch does not. The `keepalive` fetch is the fallback for
 * browsers without it.
 */
function recordClick(cta: ResolvedCta, page: PageIdentity) {
  const body = JSON.stringify({
    ...cta.log,
    path: page.path || "/",
    page_title: page.title || null,
    locale: page.locale || null,
  });
  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(
        CLICK_ENDPOINT,
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
    void fetch(CLICK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let recordkeeping break the button.
  }
}

// ───────────────────────────────────────────────────────────────
// Resolution
// ───────────────────────────────────────────────────────────────

type PageIdentity = {
  title: string;
  url: string;
  path: string;
  locale: string;
};

/**
 * Build the token map a template is rendered against.
 *
 * Page-level tokens are always present; the page's own `tokens` payload
 * overlays them, so a listing's `{page_title}` can differ from its
 * `{property_title}` without either fighting the other. Tokens with nothing
 * behind them are simply absent — `renderCtaTemplate` treats absent and empty
 * identically and closes the gap in the sentence.
 */
function buildTokenValues(
  target: FloatingCtaTargetValue | null,
  page: PageIdentity,
): FloatingCtaTokenValues {
  return {
    brand: BRAND_NAME,
    page_title: page.title,
    url: page.url,
    path: page.path,
    locale: page.locale,
    date: formatToday(page.locale),
    // Off a detail page the page's own title is the best answer to "what are
    // you enquiring about" — it is what the visitor is looking at.
    context: target?.contextRef ?? page.title,
    advisor: target?.advisorName ?? null,
    advisor_phone: target?.advisorPhone ?? null,
    advisor_email: target?.advisorEmail ?? null,
    ...target?.tokens,
  };
}

/**
 * `{date}` in the visitor's own language. Locale-aware because the rail
 * renders under /ar too, where a Gregorian date in Latin digits inside an
 * otherwise Arabic message reads as a bug.
 */
function formatToday(locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale || "en", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "";
  }
}

function resolve(
  cta: FloatingCtaRow,
  target: FloatingCtaTargetValue | null,
  fallbackPhone: string | null,
  page: PageIdentity,
): ResolvedCta | null {
  const useAdvisor = cta.use_advisor_contact && target !== null;
  const values = buildTokenValues(target, page);
  const message = renderCtaTemplate(cta.message_template, values);
  const who = target?.advisorName ?? cta.label;

  const baseLog = {
    cta_id: cta.id,
    cta_key: cta.key,
    kind: cta.kind,
    advisor_id: target?.advisorId ?? null,
    advisor_name: target?.advisorName ?? null,
    property_id: target?.propertyId ?? null,
    development_id: target?.developmentId ?? null,
    context_ref: target?.contextRef ?? null,
  };

  if (cta.kind === "email") {
    const advisorAddress = useAdvisor ? target?.advisorEmail : null;
    const address = advisorAddress ?? cta.destination ?? null;
    if (!address?.trim()) return null;
    const params = new URLSearchParams();
    // The office copy. A visitor can delete it in their own mail client
    // before sending, so `cta_clicks` — not this — is the record that the
    // enquiry happened at all.
    const cc = cta.cc_destination?.trim();
    if (cc && cc.toLowerCase() !== address.trim().toLowerCase()) {
      params.set("cc", cc);
    }
    const subject = renderCtaTemplate(cta.subject_template, values);
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
      log: {
        ...baseLog,
        destination: address.trim(),
        source: advisorAddress ? "advisor" : cta.destination ? "cta" : "cta",
      },
    };
  }

  const advisorNumber = useAdvisor ? target?.advisorPhone : null;
  const number = advisorNumber ?? cta.destination ?? fallbackPhone;
  if (!number?.trim()) return null;
  const source: ClickLog["source"] = advisorNumber
    ? "advisor"
    : cta.destination
      ? "cta"
      : "fallback";

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
      log: { ...baseLog, destination: number.trim(), source },
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
    log: { ...baseLog, destination: number.trim(), source },
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
  const [page, setPage] = useState<PageIdentity>({
    title: "",
    url: "",
    path: "",
    locale: "",
  });

  useEffect(() => {
    function read() {
      const path = window.location.pathname;
      // /ar/p/x → "ar". The locale segment is the only place the rail can
      // read it: this component is mounted by the layout, above the page that
      // knows its own params.
      const first = path.split("/")[1] ?? "";
      const next: PageIdentity = {
        title: (document.title.split(/\s+[|·—–]\s+/)[0] ?? "").trim(),
        url: window.location.href,
        path,
        locale: /^[a-z]{2}$/.test(first) ? first : "en",
      };
      setPage((current) =>
        current.title === next.title &&
        current.url === next.url &&
        current.path === next.path
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
