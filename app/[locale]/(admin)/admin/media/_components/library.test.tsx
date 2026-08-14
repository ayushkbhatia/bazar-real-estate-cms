import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MediaUsage } from "@/lib/media-usage";

const saveMediaAlt = vi.fn(async () => ({
  status: "ok" as const,
  message: "Alt text saved.",
}));
vi.mock("../_actions", () => ({
  trashMedia: vi.fn(),
  restoreMedia: vi.fn(),
  deleteMediaPermanently: vi.fn(),
  saveMediaAlt: (...args: unknown[]) =>
    (saveMediaAlt as unknown as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { MediaLibrary, type MediaLibraryItem } from "./library";

const USAGE: MediaUsage = {
  kind: "property",
  id: "p-1",
  label: "Mamsha · 3-bed",
  role: "Hero",
  href: "/admin/properties/p-1",
  live: true,
  internal: false,
};

function item(over: Partial<MediaLibraryItem> = {}): MediaLibraryItem {
  return {
    id: "m-1",
    filename: "mamsha.jpg",
    mime_type: "image/jpeg",
    size_bytes: 120_000,
    url: "https://example.test/mamsha.jpg",
    folder: "listings",
    created_at: "2026-07-01T00:00:00Z",
    deleted_at: null,
    daysInTrash: null,
    usages: [],
    state: "unused",
    alt_text: null,
    alt_text_ar: null,
    trashable: { allowed: true, reason: null },
    ...over,
  };
}

function trashButton() {
  return screen
    .getAllByRole("button")
    .find((b) => (b.getAttribute("aria-label") ?? "").match(/trash|delete/i))!;
}

describe("<MediaLibrary> trash affordance", () => {
  it("gives an unused asset an enabled trash button with the danger hover styles", () => {
    render(
      <MediaLibrary
        items={[item()]}
        view="grid"
        trashView={false}
        canDestroy={false}
      />,
    );
    const button = trashButton();
    expect(button).toBeEnabled();
    expect(button.className).toContain("hover:text-[oklch(0.45_0.13_28)]");
    expect(button.className).toContain("hover:bg-[oklch(0.95_0.05_28)]");
    expect(button.className).toContain("hover:ring-1");
    expect(button.className).toContain("hover:shadow-[0_0_0_4px");
    // The neutral hover must not ride along — two `hover:text-*` on one element
    // is a coin flip decided by CSS order, not by the order written here.
    expect(button.className).not.toContain("hover:text-bz-ink");
  });

  it("keeps the reason readable on an in-use asset, whose button can't be hovered", () => {
    render(
      <MediaLibrary
        items={[
          item({
            state: "live",
            usages: [USAGE],
            trashable: { allowed: false, reason: "In use — detach it first." },
          }),
        ]}
        view="grid"
        trashView={false}
        canDestroy={false}
      />,
    );
    const button = trashButton();
    expect(button).toBeDisabled();
    // `disabled:pointer-events-none` swallows the button's own tooltip, so the
    // explanation has to hang off a wrapper that still receives the hover.
    expect(button).not.toHaveAttribute("title");
    const wrapper = button.parentElement!;
    expect(wrapper.getAttribute("title")).toBe(
      "In use — detach it first. Used in 1 listing.",
    );
    // No danger styling on something that can't be actioned.
    expect(button.className).not.toContain("hover:bg-[oklch(0.95_0.05_28)]");
  });

  it("offers restore and permanent delete in the trash view", () => {
    render(
      <MediaLibrary
        items={[item({ deleted_at: "2026-07-20T00:00:00Z", daysInTrash: 22 })]}
        view="grid"
        trashView
        canDestroy
      />,
    );
    expect(
      screen.getByRole("button", { name: /restore/i }),
    ).toBeEnabled();
    const destroy = screen.getByRole("button", {
      name: /delete permanently/i,
    });
    expect(destroy).toBeEnabled();
    expect(destroy.className).toContain("hover:text-[oklch(0.45_0.13_28)]");
  });

  it("hides permanent delete from non-admins", () => {
    render(
      <MediaLibrary
        items={[item({ deleted_at: "2026-07-20T00:00:00Z", daysInTrash: 22 })]}
        view="grid"
        trashView
        canDestroy={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /delete permanently/i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * Alt text has been editable in exactly two places, both scoped to a property.
 * Every other image in the system — developments, areas, articles, landing
 * pages — had no alt editor at all, which is an accessibility gap before it is
 * a translation one. These pin the surface that closes it.
 */
describe("<MediaLibrary> alt text", () => {
  async function openDetails() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /where is this used/i }));
    return user;
  }

  it("offers alt text and its Arabic twin once the details dialog is open", async () => {
    render(
      <MediaLibrary
        items={[item({ alt_text: "Villa at dusk" })]}
        view="grid"
        trashView={false}
        canDestroy={false}
      />,
    );
    await openDetails();
    const alt = await screen.findByLabelText(/alt text/i);
    expect(alt).toHaveValue("Villa at dusk");
    // Collapsed, like every other Arabic twin — an English-only editor's
    // screen must not grow a second box they will never type in.
    expect(
      screen.getByRole("button", { expanded: false, name: /العربية/ }),
    ).toBeInTheDocument();
  });

  it("does not offer alt text on a PDF", async () => {
    render(
      <MediaLibrary
        items={[item({ mime_type: "application/pdf", filename: "brochure.pdf" })]}
        view="grid"
        trashView={false}
        canDestroy={false}
      />,
    );
    await openDetails();
    await screen.findByText(/no record references this file/i);
    expect(screen.queryByLabelText(/alt text/i)).not.toBeInTheDocument();
  });

  it("keeps Save disabled until something changes, then sends both languages", async () => {
    saveMediaAlt.mockClear();
    render(
      <MediaLibrary
        items={[item({ id: "m-9", alt_text: "Villa at dusk", alt_text_ar: null })]}
        view="grid"
        trashView={false}
        canDestroy={false}
      />,
    );
    const user = await openDetails();
    const save = await screen.findByRole("button", { name: /save alt text/i });
    expect(save).toBeDisabled();

    await user.clear(screen.getByLabelText(/alt text/i));
    await user.type(screen.getByLabelText(/alt text/i), "Villa at dawn");
    expect(save).toBeEnabled();
    await user.click(save);

    // The Arabic argument is sent even though it was never touched. The action
    // writes both columns in one update, so an omitted twin would be a twin
    // left behind while the editor believes they cleared it.
    await waitFor(() =>
      expect(saveMediaAlt).toHaveBeenCalledWith("m-9", "Villa at dawn", ""),
    );
  });
});
