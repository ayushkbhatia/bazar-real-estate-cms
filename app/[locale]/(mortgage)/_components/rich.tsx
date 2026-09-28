import type { ReactNode } from "react";
import Link from "@/components/i18n/link";

/**
 * The rich-text tags the flow's copy uses (00-foundations §12): `<b>` is 600
 * in ink, `<ink>` is ink at the same weight, `<link>` is a link. Passed to
 * `t.rich`, so a translation keeps its markup without the markup being HTML.
 */
export const richTags = {
  b: (chunks: ReactNode) => <b className="font-semibold text-bz-ink">{chunks}</b>,
  ink: (chunks: ReactNode) => <span className="text-bz-ink">{chunks}</span>,
};

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
export function contactTags(telHref: string, whatsappHref: string) {
  let n = 0;
  return {
    ink: (chunks: ReactNode) => {
      const href = n++ === 0 ? telHref : whatsappHref;
      return (
        <a
          href={href}
          className="text-bz-ink hover:underline"
          {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {chunks}
        </a>
      );
    },
  };
}
