import { Fragment, type ReactNode } from "react";
import type { PropertyTokens } from "@/lib/master-pages/property-page";

/**
 * A CMS template drawn with some of its `{token}`s as elements.
 *
 * `fillTokens` substitutes text, which is right almost everywhere. It is wrong
 * where a token has always been its own element — the listing reference in
 * "Ask anything about BAZ-AD-09790." sits in a `.mono` span, and `.mono` is
 * also what isolates it (`globals.css` gives it `unicode-bidi: isolate`), so
 * inside an Arabic sentence it reads `BAZ-AD-09790` rather than
 * `09790-BAZ-AD`. Flattening the template to a string would lose both.
 *
 * `tokens` must name EVERY listing token, not only the ones drawn as
 * elements. The editor offers all five in every field, and this component
 * used to be handed `{ reference }` alone — so when the client wrote
 * "Ask anything about {title}." the braces went live on every listing. Spread
 * `copy.tokens` and override the ones that need an element; the type makes a
 * call site that forgets one fail to compile.
 *
 * Same rule as `fillTokens` for anything unrecognised: a token with no entry
 * is left visible, so a typo in the CMS shows up as itself instead of silently
 * deleting a word.
 */
export function TokenText({
  template,
  tokens,
}: {
  template: string;
  tokens: Record<keyof PropertyTokens, ReactNode>;
}) {
  return (
    <>
      {template.split(/(\{\w+\})/g).map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        return (
          <Fragment key={i}>
            {/* Own keys only: `in` also matched `{constructor}`, and drawing
                that function as a child crashed the page. */}
            {name !== undefined &&
            Object.prototype.hasOwnProperty.call(tokens, name)
              ? tokens[name as keyof PropertyTokens]
              : part}
          </Fragment>
        );
      })}
    </>
  );
}
