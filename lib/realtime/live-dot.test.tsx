import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LiveDot } from "./live-dot";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Stub the Supabase browser client — LiveDot mounts the hook which
// otherwise tries to read NEXT_PUBLIC_SUPABASE_URL. The hook swallows
// the resulting error, so we just need it to not crash the test.
vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => {
    throw new Error("not configured");
  },
}));

describe("LiveDot", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the label", () => {
    render(<LiveDot channel="t:e" table="e" label="Live" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("renders as disconnected when Supabase env is missing", () => {
    render(<LiveDot channel="t:e" table="e" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("title")).toContain("disconnected");
  });

  it("uses status role for screen-reader visibility", () => {
    render(<LiveDot channel="t:e" table="e" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("survives a hot re-render with stable props", () => {
    const { rerender } = render(<LiveDot channel="t:e" table="e" />);
    act(() => {
      rerender(<LiveDot channel="t:e" table="e" />);
    });
    // No error; status still visible.
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
