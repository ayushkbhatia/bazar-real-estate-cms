import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PublishCard, type PublishCheck } from "./_publish-card";

// The card imports the server actions by reference; the module reaches for the
// Supabase server client and next/cache, neither of which belongs in jsdom.
const publishDevelopment = vi.fn();
const unpublishDevelopment = vi.fn();
vi.mock("./[id]/_actions", () => ({
  publishDevelopment: (...args: unknown[]) => publishDevelopment(...args),
  unpublishDevelopment: (...args: unknown[]) => unpublishDevelopment(...args),
}));

const COMPLETE: PublishCheck[] = [
  { label: "Starting price is set", passed: true },
  { label: "Bedrooms is set", passed: true },
  { label: "Total units is set", passed: true },
  { label: "Handover date is set", passed: true },
];

const missing = (...labels: string[]): PublishCheck[] =>
  COMPLETE.map((c) => ({ ...c, passed: !labels.includes(c.label) }));

beforeEach(() => {
  publishDevelopment.mockReset().mockResolvedValue({ status: "ok" });
  unpublishDevelopment.mockReset().mockResolvedValue({ status: "ok" });
});

function setup(props: Partial<React.ComponentProps<typeof PublishCard>> = {}) {
  return render(
    <PublishCard
      developmentId="dev-1"
      publishedAt={null}
      slug="bayviews-saadiyat"
      checks={COMPLETE}
      {...props}
    />,
  );
}

describe("PublishCard", () => {
  it("calls the project draft a draft, not an error state", () => {
    setup();
    expect(screen.getByText(/Draft — not on the public site/)).toBeInTheDocument();
  });

  it("publishes a complete draft from wherever it is rendered", () => {
    setup();
    const button = screen.getByRole("button", { name: "Publish" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(publishDevelopment).toHaveBeenCalledWith("dev-1");
  });

  it("blocks publishing while the gate fails, rather than failing on click", () => {
    // The action refuses this too; the point is that the operator can see why
    // before pressing anything.
    setup({ checks: missing("Handover date is set") });
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(publishDevelopment).not.toHaveBeenCalled();
  });

  it("names what is outstanding, and counts it", () => {
    setup({ checks: missing("Handover date is set", "Total units is set") });
    expect(
      screen.getByText("2 things left before this can go live"),
    ).toBeInTheDocument();
    expect(screen.getByText("Handover date is set")).toBeInTheDocument();
    expect(screen.getByText("Total units is set")).toBeInTheDocument();
  });

  it("reads naturally when only one thing is left", () => {
    setup({ checks: missing("Bedrooms is set") });
    expect(
      screen.getByText("One thing left before this can go live"),
    ).toBeInTheDocument();
  });

  it("drops the checklist once the project is live", () => {
    setup({ publishedAt: "2026-01-05T00:00:00.000Z", checks: missing("Bedrooms is set") });
    expect(screen.queryByText(/left before this can go live/)).toBeNull();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("unpublishes back to a draft", () => {
    setup({ publishedAt: "2026-01-05T00:00:00.000Z" });
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));
    expect(unpublishDevelopment).toHaveBeenCalledWith("dev-1");
  });

  it("offers no publish button to a role that can't publish", () => {
    // requireRole answers an unauthorised action with a 404, which would read
    // as a broken page — so the control is disabled and explained instead.
    setup({ canPublish: false });
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByText(/but not publish it/)).toBeInTheDocument();
  });

  it("points a blocked draft at the screen that can fix it", () => {
    setup({
      checks: missing("Bedrooms is set"),
      fixHref: "/admin/pages/sub/development/bayviews-saadiyat",
    });
    expect(screen.getByRole("link", { name: "Add the key facts" })).toHaveAttribute(
      "href",
      "/admin/pages/sub/development/bayviews-saadiyat",
    );
  });
});
