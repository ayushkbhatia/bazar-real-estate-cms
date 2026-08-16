import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SearchAppearanceCard,
  SearchResultPreview,
} from "./search-appearance";
import { SEO_TITLE_DISPLAY } from "@/lib/schemas/seo";

const BASE = {
  path: "/services/sell",
  fallbackTitle: "Sell or rent out your property in Abu Dhabi | Bazar · Bazar",
  fallbackDescription: "Tell us about your property.",
  faviconUrl: null,
  brandName: "Bazar Real Estate",
};

/**
 * The preview is the feature — the two fields beside it are ordinary inputs.
 * What is worth pinning is that it never flatters the copy: it must show the
 * cut where Google makes one, and it must not present an inherited fallback
 * as if it were something an editor wrote.
 */
describe("SearchResultPreview", () => {
  it("draws the path as a result breadcrumb", () => {
    render(<SearchResultPreview {...BASE} title="" description="" />);
    expect(
      screen.getByText("bazarrealestate.ae › services › sell"),
    ).toBeInTheDocument();
  });

  it("shows the live fallback when a field is blank, and says so", () => {
    render(<SearchResultPreview {...BASE} title="" description="" />);
    expect(screen.getByText(/Sell or rent out your property/)).toBeInTheDocument();
    expect(
      screen.getByText(/Greyed text is the fallback this page publishes today/),
    ).toBeInTheDocument();
  });

  it("stops calling it a fallback once both fields are authored", () => {
    render(
      <SearchResultPreview
        {...BASE}
        title="Sell your Abu Dhabi property"
        description="One senior advisor, valuation through to transfer."
      />,
    );
    expect(screen.queryByText(/Greyed text is the fallback/)).toBeNull();
  });

  it("truncates a long title at a word boundary rather than mid-word", () => {
    const title =
      "Sell or rent out your Abu Dhabi property with a senior advisor guiding every step";
    render(<SearchResultPreview {...BASE} title={title} description="x" />);
    // The heading element holds the clipped text plus an ellipsis span, so its
    // textContent carries the "…" — strip it to get what was actually kept.
    const rendered =
      screen.getByText(/^Sell or rent out your Abu Dhabi/).textContent ?? "";
    expect(rendered.endsWith("…")).toBe(true);
    const shown = rendered.slice(0, -1);
    expect(shown.length).toBeLessThanOrEqual(SEO_TITLE_DISPLAY);
    expect(title.startsWith(shown)).toBe(true);
    // A boundary cut, not a slice through a word.
    expect(title[shown.length]).toBe(" ");
  });

  it("warns when nothing anywhere describes the page", () => {
    // Google writes its own snippet in this case, which is the one state an
    // editor cannot see from a blank input box.
    render(
      <SearchResultPreview
        {...BASE}
        fallbackDescription={null}
        title=""
        description=""
      />,
    );
    expect(
      screen.getByText(/Google will write its own snippet/),
    ).toBeInTheDocument();
  });
});

/**
 * The card is the same preview plus two inputs and a save. What is worth
 * pinning is the wiring an editor would notice immediately if it broke: typing
 * updates the rehearsal live, and the fields it sends are the ones it shows.
 */
describe("SearchAppearanceCard", () => {
  const EMPTY = {
    meta_title: null,
    meta_description: null,
    meta_title_ar: null,
    meta_description_ar: null,
  };

  it("starts on the fallback and follows the title field as it is typed", async () => {
    const user = userEvent.setup();
    render(
      <SearchAppearanceCard
        {...BASE}
        initial={EMPTY}
        onSave={async () => ({ status: "ok" })}
      />,
    );

    expect(screen.getByText(/Sell or rent out your property/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search title"), "Sell with Bazar");
    expect(screen.getByText("Sell with Bazar")).toBeInTheDocument();
    expect(screen.queryByText(/Sell or rent out your property/)).toBeNull();
  });

  it("sends both languages, with a cleared field as an empty string", async () => {
    const user = userEvent.setup();
    const sent: unknown[] = [];
    render(
      <SearchAppearanceCard
        {...BASE}
        initial={{ ...EMPTY, meta_title: "Old title" }}
        onSave={async (input) => {
          sent.push(input);
          return { status: "ok" };
        }}
      />,
    );

    await user.clear(screen.getByLabelText("Search title"));
    await user.click(screen.getByRole("button", { name: /save search/i }));

    // "" is what the schema turns into null — the clear has to reach the
    // action as a value, not as an omitted key.
    expect(sent).toEqual([
      {
        meta_title: "",
        meta_description: "",
        meta_title_ar: "",
        meta_description_ar: "",
      },
    ]);
  });

  it("keeps the Arabic input collapsed until it is asked for", async () => {
    const user = userEvent.setup();
    render(
      <SearchAppearanceCard
        {...BASE}
        initial={EMPTY}
        onSave={async () => ({ status: "ok" })}
      />,
    );
    expect(screen.queryByLabelText("Search title (Arabic)")).toBeNull();
    await user.click(screen.getAllByText("العربية")[0]);
    expect(screen.getByLabelText("Search title (Arabic)")).toHaveAttribute(
      "dir",
      "rtl",
    );
  });
});
