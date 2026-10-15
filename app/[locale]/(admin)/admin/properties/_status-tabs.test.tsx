import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusTabs } from "./_status-tabs";

const counts = { all: 9, draft: 1, in_review: 0, published: 7, off_market: 1, archived: 0 };

describe("StatusTabs", () => {
  it("links each tab to its status alone when no type is chosen", () => {
    render(<StatusTabs active="all" counts={counts} />);
    expect(screen.getByRole("tab", { name: /^All/ }).getAttribute("href")).toBe("/admin/properties");
    expect(screen.getByRole("tab", { name: /^Published/ }).getAttribute("href")).toBe("/admin/properties?status=published");
  });

  it("keeps the Type filter when switching status", () => {
    render(<StatusTabs active="published" counts={counts} type="villa" />);
    expect(screen.getByRole("tab", { name: /^All/ }).getAttribute("href")).toBe("/admin/properties?type=villa");
    expect(screen.getByRole("tab", { name: /^Drafts/ }).getAttribute("href")).toBe("/admin/properties?status=draft&type=villa");
  });
});
