import { Fragment, type ReactNode } from "react";

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
 * Same rule as `fillTokens` for anything unrecognised: a token with no entry
 * is left visible, so a typo in the CMS shows up as itself instead of silently
 * deleting a word.
 */
export function TokenText({
  template,
  tokens,
}: {
  template: string;
  tokens: Record<string, ReactNode>;
}) {
  return (
    <>
      {template.split(/(\{\w+\})/g).map((part, i) => {
        const name = /^\{(\w+)\}$/.exec(part)?.[1];
        return (
          <Fragment key={i}>
            {name !== undefined && name in tokens ? tokens[name] : part}
          </Fragment>
        );
      })}
    </>
  );
}
