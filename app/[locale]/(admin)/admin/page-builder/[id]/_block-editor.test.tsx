import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { newBlockInstance } from "@/lib/page-builder/catalogue";
import { heroMedia } from "@/lib/page-builder/blocks/openers";
import { faq } from "@/lib/page-builder/blocks/content";
import { ctaBand } from "@/lib/page-builder/blocks/conversion";
import type { BlockInstance } from "@/lib/page-builder/types";
import { BlockEditor } from "./_block-editor";

/**
 * The section list.
 *
 * The editor holds server actions by reference; that module reaches for the
 * Supabase server client and next/cache, neither of which belongs in jsdom.
 */
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../_actions", () => ({
  saveLandingBlocks: vi.fn(async () => ({ status: "ok", message: "Draft saved." })),
  discardLandingDraft: vi.fn(async () => ({ status: "ok", message: "Discarded." })),
}));

beforeAll(() => {
  // Radix's bottom sheet measures the viewport on open.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
});

function setup(blocks: BlockInstance[]) {
  return render(
    <BlockEditor
      pageId="page-1"
      initial={blocks}
      media={[]}
      seeds={{}}
      hasDraft={false}
      isPublished={false}
    />,
  );
}

function rows() {
  return screen
    .getAllByRole("listitem")
    .filter((li) => li.querySelector("button[aria-label^='Move ']"));
}

describe("BlockEditor", () => {
  it("lists every block with its label", () => {
    setup([newBlockInstance(heroMedia), newBlockInstance(faq)]);
    expect(screen.getByText("Media hero")).toBeInTheDocument();
    expect(screen.getByText("FAQ")).toBeInTheDocument();
  });

  it("disables the move buttons at the ends of the list", () => {
    setup([newBlockInstance(heroMedia), newBlockInstance(faq)]);
    expect(screen.getByLabelText("Move Media hero up")).toBeDisabled();
    expect(screen.getByLabelText("Move FAQ down")).toBeDisabled();
    expect(screen.getByLabelText("Move Media hero down")).toBeEnabled();
  });

  it("moves a block down and keeps the list in the new order", () => {
    setup([newBlockInstance(heroMedia), newBlockInstance(faq)]);
    fireEvent.click(screen.getByLabelText("Move Media hero down"));
    const labels = rows().map((li) => li.textContent ?? "");
    expect(labels[0]).toContain("FAQ");
    expect(labels[1]).toContain("Media hero");
  });

  it("gives the move buttons a 44px touch target", () => {
    // This screen is meant to be usable from a phone — which is also why the
    // reorder is arrows rather than the master-page editor's dnd-kit.
    setup([newBlockInstance(heroMedia), newBlockInstance(faq)]);
    const cls = screen.getByLabelText("Move FAQ up").className;
    expect(cls).toContain("h-11");
    expect(cls).toContain("w-11");
  });

  it("expands a block to reveal its fields", () => {
    setup([newBlockInstance(faq)]);
    expect(screen.queryByText("Questions")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Expand"));
    // The list field's own label, from the registry.
    expect(screen.getByText("Questions")).toBeInTheDocument();
  });

  it("summarises a collapsed block by its own copy", () => {
    const block = newBlockInstance(heroMedia);
    block.values.title = "Saadiyat Lagoons launch";
    setup([block]);
    expect(screen.getByText("Saadiyat Lagoons launch")).toBeInTheDocument();
  });

  it("duplicates a block into a distinct instance", () => {
    setup([newBlockInstance(faq)]);
    fireEvent.click(screen.getByLabelText("Duplicate FAQ"));
    // Two rows, so the copy is a real second instance rather than a shared one.
    expect(rows()).toHaveLength(2);
  });

  it("hides a block without removing it", () => {
    setup([newBlockInstance(faq)]);
    fireEvent.click(screen.getByLabelText("Hide FAQ"));
    expect(screen.getByLabelText("Show FAQ")).toBeInTheDocument();
    expect(rows()).toHaveLength(1);
  });

  it("shows a block this build can't render as a locked card", () => {
    // Kept, never dropped — its copy exists nowhere else. There is no field
    // editor to draw for it, so the row says why.
    setup([
      { id: "u", type: "market_stats_strip", v: 1, enabled: true, values: {} },
    ]);
    expect(screen.getByText("Unavailable section")).toBeInTheDocument();
    expect(screen.getByText(/market_stats_strip/)).toBeInTheDocument();
    // No field editor, and no way to edit it into something else.
    expect(screen.queryByLabelText("Expand")).not.toBeInTheDocument();
  });

  it("enables Save only once something changed", () => {
    setup([newBlockInstance(faq)]);
    const save = screen.getByRole("button", { name: /save draft/i });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Hide FAQ"));
    expect(save).toBeEnabled();
  });

  it("warns that a live page keeps serving the published version", () => {
    render(
      <BlockEditor
        pageId="page-1"
        initial={[newBlockInstance(ctaBand)]}
        media={[]}
        seeds={{}}
        hasDraft
        isPublished
      />,
    );
    expect(
      screen.getByText(/visitors keep seeing the published version/i),
    ).toBeInTheDocument();
  });

  it("offers the empty state before anything is added", () => {
    setup([]);
    expect(screen.getByText(/Nothing here yet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add section/i }),
    ).toBeInTheDocument();
  });

  it("opens the catalogue when Add section is clicked", () => {
    // The trigger has to be a SheetTrigger: BottomSheet renders whatever it is
    // given verbatim, so a bare Button never flips the sheet open and the one
    // control an editor touches on every page is inert.
    setup([]);
    expect(screen.queryByText("Add a section")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add section/i }));
    expect(screen.getByText("Add a section")).toBeInTheDocument();
  });

  it("adds the picked section to the list", () => {
    setup([]);
    fireEvent.click(screen.getByRole("button", { name: /add section/i }));
    fireEvent.click(screen.getByText(faq.label));
    expect(rows()).toHaveLength(1);
    expect(screen.getByLabelText(`Move ${faq.label} up`)).toBeInTheDocument();
  });
});
