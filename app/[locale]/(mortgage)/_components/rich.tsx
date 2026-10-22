import type { ReactNode } from "react";
import Link from "@/components/i18n/link";
import { isolateAuto, isolateLtr } from "@/lib/i18n/bidi";

/**
 * The rich-text tags the flow's copy uses (00-foundations §12): `<b>` is 600
 * in ink, `<ink>` is ink at the same weight, `<link>` is a link. Passed to
 * `t.rich`, so a translation keeps its markup without the markup being HTML.
 */
export const richTags = {
  b: (chunks: ReactNode) => <b className="font-semibold text-bz-ink">{chunks}</b>,
  ink: (chunks: ReactNode) => <span className="text-bz-ink">{chunks}</span>,
};

/**
 * A value that reads left to right whatever the page does: a phone number,
 * an email, a date of birth. Right to left, "+971 50 218 4417" would
 * otherwise come out as "4417 218 50 971+" and "14 / 03 / 1990" as
 * "1990 / 03 / 14". `<bdi dir="ltr">` isolates it from the sentence around it.
 */
export function Ltr({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

/**
 * The same for a value dropped into a message as an argument, where no markup
 * can go: wrapped in an isolate (`lib/i18n/bidi`), so a masked mobile,
 * a reference or a Latin name keeps its own order inside an Arabic sentence.
 * A value with letters takes their direction (FIRST STRONG ISOLATE: an Arabic
 * name stays right to left); one without — "+971 50 ••• 4567" — is set left to
 * right (LEFT-TO-RIGHT ISOLATE), since Chrome reads an FSI with nothing strong
 * in it as the sentence's direction. Invisible, and harmless in English.
 */
export function isolate(value: string): string {
  return /\p{L}/u.test(value) ? isolateAuto(value) : isolateLtr(value);
}

/** `<link>` as a link to `href`, underlined in ink-2 as W3's fine print shows it. */
export function linkTag(href: string) {
  return function renderLink(chunks: ReactNode) {
    return (
      <Link href={href} className="text-bz-ink-2 underline underline-offset-2 hover:text-bz-ink">
        {chunks}
      </Link>
    );
  };
}

/** Phone numbers inside `<ink>` are links too (00-foundations §12). */
/** The number written inside a tag, as digits with any leading +; null when it isn't a phone number. */
export function numberIn(chunks: ReactNode): string | null {
  const text = (Array.isArray(chunks) ? chunks : [chunks]).filter((c) => typeof c === "string" || typeof c === "number").join("");
  const digits = text.replace(/[^\d+]/g, "");
  return digits.replace(/\D/g, "").length >= 7 ? digits : null;
}

export function contactTags(telHref: string, whatsappHref: string) {
  let n = 0;
  return {
    ink: (chunks: ReactNode) => {
      // The link follows the number as the copy writes it, so an editor who
      // changes the number in Pages & blocks → Wizards changes where it dials;
      // the design's numbers stand in when the tag holds no number.
      const first = n++ === 0;
      const written = numberIn(chunks);
      const href = written ? (first ? `tel:${written}` : `https://wa.me/${written.replace(/^\+/, "")}`) : first ? telHref : whatsappHref;
      return (
        <a
          href={href}
          // A number keeps its order inside an Arabic sentence.
          {...(written ? { dir: "ltr" } : {})}
          className="text-bz-ink hover:underline"
          {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {chunks}
        </a>
      );
    },
  };
}
