/**
 * `FAQPage` structured data for a list of questions.
 *
 * Google stopped showing FAQ rich results for most sites in 2023, so this is
 * not about a search-result widget. It is the cleanest machine-readable
 * statement of "this page answers these questions", which is what AI search
 * engines (and long-tail matching) read. It matters most where the answers are
 * not in the HTML at all: the home accordion renders only the open answer.
 *
 * Renders nothing for an empty list. Plain text only: an answer is a string,
 * and `JSON.stringify` escapes it, `<` included via the replace below, so a
 * question can never close the script element.
 */
export function FaqJsonLd({ items }: { items: [string, string][] }) {
  if (items.length === 0) return null;
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(ld).replace(/</g, "\\u003c"),
      }}
    />
  );
}
