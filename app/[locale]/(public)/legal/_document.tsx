import { LegalDocFrame, type LegalDocSlug, type LegalLocale } from "./_layout";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str, list } from "@/lib/master-pages";
import type { MasterPageKey } from "@/lib/master-pages/types";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Renders a legal document out of its master page.
 *
 * All three documents were hardcoded JSX — the only public copy on the site
 * the client could not edit. They now come from `MASTER_PAGES`, so the
 * existing editor, the derived `_ar` twins and the publish gate all apply
 * without new machinery.
 *
 * The body is plain text rather than rich text on purpose: `SimpleFieldKind`
 * has no rich-text member, and a legal clause does not need one. Four
 * conventions carry the shape a lawyer actually uses — a blank line starts a
 * paragraph, a line opening with `•` becomes a bullet, `**text**` is bold, and
 * an email address becomes a mailto link — which keeps the stored value
 * something a person can paste out of Word and read back.
 *
 * Bold and the mailto arrived with the privacy policy, whose clauses open
 * their bullets with a bold lead-in ("**WhatsApp integration** — …") and whose
 * §10 publishes the mailbox a PDPL request goes to. Without them the
 * conversion from JSX would have been a quiet downgrade of a legal document.
 */

/**
 * `**bold**` and bare email addresses, inside one line of clause text.
 *
 * Split-with-a-capture, so the delimiters survive into the array. The test
 * regexes are separate objects from the splitter and carry no `g` flag: a
 * global regex holds `lastIndex` between calls, which makes `.test` return
 * alternating answers for the same string.
 */
const INLINE = /(\*\*[^*]+\*\*|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <b key={i}>{part.slice(2, -2)}</b>;
        }
        if (EMAIL.test(part)) {
          return (
            // `dir="ltr"` because an address inside Arabic prose otherwise
            // renders with its parts in the wrong order.
            <a key={i} href={`mailto:${part}`} dir="ltr">
              {part}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

/**
 * Exported for `_document.test.tsx`. The renderer is the only place the
 * clause conventions are defined, and a legal document is a bad place to find
 * out that a bullet stopped being a bullet.
 */
export function Body({ text }: { text: string }) {
  // Split on blank lines first so a bullet run stays inside its own block.
  const blocks = text.split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const bullets = lines.filter((l) => l.startsWith("•"));
        // A block is a list only if every line in it is one — a paragraph
        // that happens to contain a bullet mid-way stays a paragraph.
        if (bullets.length === lines.length && bullets.length > 0) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>
                  <Inline text={l.replace(/^•\s*/, "")} />
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            <Inline text={block.trim()} />
          </p>
        );
      })}
    </>
  );
}

export async function LegalDocument({
  pageKey,
  active,
  locale,
  translation,
}: {
  pageKey: MasterPageKey;
  active: LegalDocSlug;
  locale: Locale;
  /** The same document in the other language, when the page offers a switch. */
  translation?: { label: string; href: string; locale: LegalLocale };
}) {
  const content = await getMasterPageContent(pageKey, locale);
  // `section()` returns null for a key the stored document has dropped. The
  // registry always defines "doc", so this is defensive rather than expected —
  // and an empty bag renders the frame with no clauses instead of throwing.
  const doc = content.section("doc")?.values ?? {};

  return (
    <LegalDocFrame
      active={active}
      locale={locale}
      title={str(doc, "title") ?? "Legal"}
      effective={str(doc, "effective") ?? ""}
      // Both optional in the registry: terms and cookies say "Effective" and
      // route to the DPO mailbox, which are the frame's own defaults, so only
      // privacy sets them.
      dateLabel={str(doc, "date_label") ?? undefined}
      contactEmail={str(doc, "contact_email") ?? undefined}
      translation={translation}
    >
      {list<Record<string, string | null>>(doc, "clauses").map((clause, i) => (
        <section key={i}>
          <h2>{str(clause, "heading") ?? ""}</h2>
          <Body text={str(clause, "body") ?? ""} />
        </section>
      ))}
    </LegalDocFrame>
  );
}
