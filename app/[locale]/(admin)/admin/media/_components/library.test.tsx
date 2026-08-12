import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { MediaUsage } from "@/lib/media-usage";

vi.mock("../_actions", () => ({
  trashMedia: vi.fn(),
  restoreMedia: vi.fn(),
  deleteMediaPermanently: vi.fn(),
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
