import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArabicTypographyForm } from "./_form";
import type { ArabicFontSettings } from "@/lib/schemas/arabic-fonts";

/**
 * The screen is admin-only and has no e2e coverage (Playwright can only assert
 * the login redirect — there are no staff credentials in CI), so this is the
 * only thing that renders it. It asserts the two behaviours that would be
 * silent failures rather than visible ones: that deleting a family releases
 * any role pointing at it, and that the specimen stylesheet is the public
 * serialiser's output rather than an approximation of it.
 */

vi.mock("./_actions", () => ({
  updateArabicFontSettings: vi.fn(async () => ({ status: "ok" as const })),
}));
vi.mock("../../media/_upload-client", () => ({
  uploadToLibrary: vi.fn(),
}));

const settings = (over: Partial<ArabicFontSettings> = {}): ArabicFontSettings => ({
  enabled: true,
  families: [
    {
      id: "fam-1",
      name: "Bukra",
      slug: "bzar-bukra",
      files: [
        {
          url: "https://cdn.example.com/bukra.woff2",
          filename: "bukra-regular.woff2",
          format: "woff2",
          weight: "400",
          style: "normal",
        },
      ],
    },
  ],
  roles: { display: "fam-1", body: "fam-1", eyebrow: null, mono: null },
  ...over,
});

/** The specimen's stylesheet, as the DOM actually holds it. */
const specimenCss = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("style"))
    .map((s) => s.textContent ?? "")
    .join("");

describe("ArabicTypographyForm", () => {
  it("names the two delete buttons apart", () => {
    // "Remove Bukra" and "Remove bukra-regular.woff2" read as the same control
    // to anyone navigating by accessible name, and they do very different
    // things — one drops a file, the other drops the family and every role
    // assignment pointing at it.
    render(<ArabicTypographyForm initial={settings()} />);
    expect(
      screen.getByRole("button", { name: /remove the bukra family/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove the file bukra-regular/i }),
    ).toBeInTheDocument();
  });

  it("renders the uploaded family and its weight", () => {
    render(<ArabicTypographyForm initial={settings()} />);
    expect(screen.getByDisplayValue("Bukra")).toBeInTheDocument();
    expect(screen.getByText("bukra-regular.woff2")).toBeInTheDocument();
    expect(screen.getByText("400 · Regular")).toBeInTheDocument();
  });

  it("shows the specimen in the assigned face, using the public serialiser", () => {
    const { container } = render(<ArabicTypographyForm initial={settings()} />);
    const css = specimenCss(container);
    expect(css).toContain('@font-face{font-family:"bzar-bukra"');
    expect(css).toContain('src:url("https://cdn.example.com/bukra.woff2")');
  });

  it("previews a face that is uploaded but not switched on yet", () => {
    // The point of the kill switch is that you can look before you leap.
    const { container } = render(
      <ArabicTypographyForm initial={settings({ enabled: false })} />,
    );
    expect(specimenCss(container)).toContain("bzar-bukra");
  });

  it("releases every role when its family is deleted", async () => {
    const user = userEvent.setup();
    const { container } = render(<ArabicTypographyForm initial={settings()} />);

    await user.click(
      screen.getByRole("button", { name: /remove the bukra family/i }),
    );

    // A role still pointing at a deleted family fails the schema on save, with
    // an error naming something the operator can no longer see.
    expect(screen.queryByDisplayValue("Bukra")).not.toBeInTheDocument();
    expect(specimenCss(container)).toBe("");
    expect(
      screen.getByText(/no fonts uploaded/i),
    ).toBeInTheDocument();
  });

  it("warns when a role is assigned to nothing while switched on", () => {
    render(
      <ArabicTypographyForm
        initial={settings({
          roles: { display: null, body: null, eyebrow: null, mono: null },
        })}
      />,
    );
    expect(
      screen.getByText(/no role has a font assigned yet/i),
    ).toBeInTheDocument();
  });

  it("flags a non-WOFF2 file as the download cost it is", () => {
    render(
      <ArabicTypographyForm
        initial={settings({
          families: [
            {
              id: "fam-1",
              name: "Bukra",
              slug: "bzar-bukra",
              files: [
                {
                  url: "https://cdn.example.com/bukra.otf",
                  filename: "bukra.otf",
                  format: "opentype",
                  weight: "400",
                  style: "normal",
                },
              ],
            },
          ],
        })}
      />,
    );
    expect(screen.getByText(/one file is/i)).toBeInTheDocument();
  });

  it("sets the specimen in Arabic and right-to-left, so :lang(ar) applies to it", () => {
    const { container } = render(<ArabicTypographyForm initial={settings()} />);
    const specimen = container.querySelector('[lang="ar"]');
    expect(specimen).not.toBeNull();
    expect(specimen).toHaveAttribute("dir", "rtl");
    expect(within(specimen as HTMLElement).getByText(/أبوظبي/)).toBeInTheDocument();
  });
});
