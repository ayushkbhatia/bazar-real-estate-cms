import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { InternalLinkTarget } from "./_link-targets";
import {
  InternalLinkDialog,
  type InternalLinkRequest,
} from "./_internal-link-dialog";

function area(id: string, name: string, sub: string, slug: string): InternalLinkTarget {
  const href = `/areas/${slug}`;
  return { kind: "area", id, name, href, slug, detail: { sub, href } };
}

const TARGETS: InternalLinkTarget[] = [
  area("a1", "Saadiyat Island", "Area · Abu Dhabi", "saadiyat-island"),
  area("a3", "Yas Acres", "Community · Yas Island", "yas-acres"),
  area("a2", "Yas Island", "Area · Abu Dhabi", "yas-island"),
  {
    kind: "development",
    id: "d1",
    name: "Saadiyat Lagoons",
    href: "/developments/saadiyat-lagoons",
    slug: "saadiyat-lagoons",
    detail: { code: "Aldar", sub: "Saadiyat Island", facts: ["Handover Q4 2027"], price: "From AED 5.2M" },
  },
  {
    kind: "property",
    id: "p1",
    name: "Sea-view villa",
    href: "/p/sea-view-villa-baz-ad-04891",
    slug: "BAZ-AD-04891",
    detail: { code: "BAZ-AD-04891", sub: "Villa · Saadiyat Island", facts: ["5 bed", "6 bath", "6,200 ft²"], price: "AED 12.5M", badge: "For sale" },
  },
  {
    kind: "property",
    id: "p2",
    name: "Sea-view villa",
    href: "/p/sea-view-villa-baz-ad-05555",
    slug: "BAZ-AD-05555",
    detail: { code: "BAZ-AD-05555", sub: "Villa · Saadiyat Island", facts: ["6 bed", "7 bath", "6,555 ft²"], price: "AED 14.5M", badge: "For sale" },
  },
];

/** Each row's record name — the first line OptionBody draws. */
const names = () =>
  screen
    .getAllByRole("option")
    .map((o) => o.querySelector(".truncate")?.textContent);

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
      "Listings2",
    ]);
    expect(names()).toEqual(["Saadiyat Island", "Yas Acres", "Yas Island"]);
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
    expect(names()).toEqual(["Yas Island", "Yas Acres"]);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[2], as: "card" });
  });

  it("finds a listing by its reference", () => {
    open(insert);
    fireEvent.click(screen.getByRole("tab", { name: /Listings/ }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "baz-ad-048" },
    });
    expect(screen.getByRole("option").textContent).toContain("BAZ-AD-04891");
  });

  it("tells same-titled listings apart by their facts, as the shared pickers do", () => {
    // Both are "Sea-view villa". "5 bed" is a whole figure, so it must not
    // find the other one through "6,555 ft²".
    const { onChoose } = open(insert);
    fireEvent.click(screen.getByRole("tab", { name: /Listings/ }));
    const search = screen.getByRole("combobox");
    fireEvent.change(search, { target: { value: "5 bed" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChoose).toHaveBeenCalledWith({ target: TARGETS[4], as: "card" });
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
