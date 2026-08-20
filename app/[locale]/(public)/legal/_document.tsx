import { LegalDocFrame, type LegalDocSlug } from "./_layout";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { str, list } from "@/lib/master-pages";
import type { MasterPageKey } from "@/lib/master-pages/types";
import type { Locale } from "@/lib/i18n/locales";

/**
 * Renders a legal document out of its master page.
 *
 * Terms and the cookie policy were hardcoded JSX — the only public copy on the
 * site the client could not edit, and the only pages with no Arabic at all.
 * Both now come from `MASTER_PAGES`, so the existing editor, the derived `_ar`
 * twins and the publish gate all apply without new machinery.
 *
 * The body is plain text rather than rich text on purpose: `SimpleFieldKind`
 * has no rich-text member, and a legal clause does not need one. Two
 * conventions carry the shape a lawyer actually uses — a blank line starts a
 * paragraph, and a line opening with `•` becomes a bullet — which keeps the
 * stored value something a person can paste out of Word and read back.
 */
function Body({ text }: { text: string }) {
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
                <li key={j}>{l.replace(/^•\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block.trim()}</p>;
      })}
    </>
  );
}

export async function LegalDocument({
  pageKey,
  active,
  locale,
}: {
  pageKey: MasterPageKey;
  active: LegalDocSlug;
  locale: Locale;
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
      // Still a draft in both languages: the English is the in-house text it
      // always was, and the Arabic is a machine first draft the client
      // replaces (ADR-0008). The frame's notice is what stops a reader taking
      // either for a signed policy.
      draft
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
