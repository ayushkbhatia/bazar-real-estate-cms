import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { InternalLinkTarget } from "@/lib/internal-links/types";
import {
  InternalLinkDialog,
  type InternalLinkRequest,
} from "./_internal-link-dialog";

const TARGETS: InternalLinkTarget[] = [
  { kind: "area", id: "a1", name: "Saadiyat Island", detail: "Area · Abu Dhabi", href: "/areas/saadiyat-island", thumb: null },
  { kind: "area", id: "a3", name: "Yas Acres", detail: "Sub-community · Yas Island", href: "/areas/yas-acres", thumb: null },
  { kind: "area", id: "a2", name: "Yas Island", detail: "Area · Abu Dhabi", href: "/areas/yas-island", thumb: null },
  { kind: "development", id: "d1", name: "Saadiyat Lagoons", detail: "Aldar · Saadiyat Island", href: "/developments/saadiyat-lagoons", thumb: null },
  { kind: "property", id: "p1", name: "Sea-view villa", detail: "BAZ-AD-04891 · Saadiyat Island · AED 12.5M", href: "/p/sea-view-villa-baz-ad-04891", thumb: null },
];

function open(request: InternalLinkRequest) {
  const onChoose = vi.fn();
  const onUnlink = vi.fn();
  const onClose = vi.fn();
  render(
    <InternalLinkDialog
      request={request}
      targets={TARGETS}
      onChoose={onChoose}
      onUnlink={onUnlink}
      onClose={onClose}
    />,
  );
  return { onChoose, onUnlink, onClose };
}

const insert: InternalLinkRequest = {
  mode: "insert",
  hasTextSelection: false,
  initial: null,
};

describe("InternalLinkDialog", () => {
  it("lists one kind at a time, with a count on each tab", () => {
    open(insert);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Areas3",
      "Projects1",
      "Listings1",
    ]);
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Saadiyat IslandArea · Abu Dhabi",
      "Yas AcresSub-community · Yas Island",
      "Yas IslandArea · Abu Dhabi",
    ]);
  });

  it("filters as you type, and Enter inserts the first match as a card", () => {
    const { onChoose } = open(insert);
    const search = screen.getByRole("combobox");
    fireEvent.change(search, { target: { value: "saad" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[0], as: "card" });
  });

  it("puts the record NAMED what was typed ahead of one merely inside it", () => {
    // Yas Acres matches "yas island" through its parent, and sorts first
    // alphabetically — Enter must still insert Yas Island.
    const { onChoose } = open(insert);
    const search = screen.getByRole("combobox");
    fireEvent.change(search, { target: { value: "  Yas   island " } });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Yas IslandArea · Abu Dhabi",
      "Yas AcresSub-community · Yas Island",
    ]);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[2], as: "card" });
  });

  it("finds a listing by its reference", () => {
    open(insert);
    fireEvent.click(screen.getByRole("tab", { name: /Listings/ }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "baz-ad-048" },
    });
    expect(screen.getByRole("option").textContent).toContain("Sea-view villa");
  });

  it("moves the highlight with the arrow keys", () => {
    const { onChoose } = open(insert);
    const search = screen.getByRole("combobox");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[1], as: "card" });
    expect(TARGETS[1].name).toBe("Yas Acres");
  });

  it("says so when nothing matches", () => {
    open(insert);
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "atlantis" },
    });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No area matches “atlantis”.")).toBeTruthy();
  });

  it("offers card and compact, but no text link, with nothing selected", () => {
    const { onChoose } = open(insert);
    expect(screen.queryByLabelText(/Text link/)).toBeNull();
    fireEvent.click(screen.getByLabelText(/Compact/));
    fireEvent.click(screen.getByRole("button", { name: "Insert compact link" }));
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[0], as: "compact" });
  });

  it("defaults to linking the words when words are selected", () => {
    const { onChoose } = open({ ...insert, hasTextSelection: true });
    fireEvent.doubleClick(screen.getAllByRole("option")[2]);
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[2], as: "text" });
  });

  it("re-opens a block on its record and its variant", () => {
    const { onChoose } = open({
      mode: "edit-block",
      hasTextSelection: false,
      pos: 12,
      initial: { kind: "development", id: "d1", as: "compact" },
    });
    expect(screen.getByRole("tab", { selected: true }).textContent).toContain(
      "Projects",
    );
    fireEvent.click(screen.getByRole("button", { name: "Save block" }));
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[3], as: "compact" });
  });

  it("edits a text link as a text link, and can remove it", () => {
    const { onChoose, onUnlink } = open({
      mode: "edit-text",
      hasTextSelection: true,
      initial: { kind: "area", id: "a2", as: "text" },
    });
    // Nothing to choose between: a text link stays a text link.
    expect(screen.queryByText("Show it as")).toBeNull();
    const selected = screen
      .getAllByRole("option")
      .find((o) => o.getAttribute("aria-selected") === "true")!;
    expect(within(selected).getByText("Yas Island")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Update link" }));
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[2], as: "text" });
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    expect(onUnlink).toHaveBeenCalled();
  });

  it("shows where the highlighted record links to", () => {
    open(insert);
    expect(
      screen.getByRole("link", { name: /\/areas\/saadiyat-island/ }).getAttribute(
        "href",
      ),
    ).toBe("/areas/saadiyat-island");
  });
});
