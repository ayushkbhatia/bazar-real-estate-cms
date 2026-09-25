import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { TokenText } from "./token-text";

const TOKENS = {
  reference: "BAZ-AD-08128",
  title: "Yas Riva Reserve",
  area: "Yas Island",
  advisor: "Sample Advisor",
  type: "villa",
};

function draw(template: string, tokens = TOKENS) {
  return render(
    <p>
      <TokenText template={template} tokens={tokens} />
    </p>,
  ).container.textContent;
}

describe("TokenText", () => {
  it("fills every listing token, not only the reference", () => {
    // The client's wording on production: with only `{reference}` supplied,
    // this rendered "Ask anything about {title}." on every listing.
    expect(draw("Ask anything about {title}.")).toBe(
      "Ask anything about Yas Riva Reserve.",
    );
    expect(
      draw(
        "Please fill out the information below to learn more about {title} in {area}.",
      ),
    ).toBe(
      "Please fill out the information below to learn more about Yas Riva Reserve in Yas Island.",
    );
    expect(draw("{reference} · {type} · {advisor}")).toBe(
      "BAZ-AD-08128 · villa · Sample Advisor",
    );
  });

  it("draws a token as the element it is given", () => {
    const { container } = render(
      <TokenText
        template="Ask anything about {reference}."
        tokens={{ ...TOKENS, reference: <span className="mono">X-1</span> }}
      />,
    );
    expect(container.querySelector("span.mono")?.textContent).toBe("X-1");
    expect(container.textContent).toBe("Ask anything about X-1.");
  });

  it("leaves an unknown token visible", () => {
    expect(draw("Ask about {name}.")).toBe("Ask about {name}.");
  });

  it("does not reach the object prototype", () => {
    // `name in tokens` matched these, and a function is not a valid child.
    expect(draw("{constructor} {toString} {hasOwnProperty}")).toBe(
      "{constructor} {toString} {hasOwnProperty}",
    );
  });
});
