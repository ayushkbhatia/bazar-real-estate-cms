import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { captureExceptionSpy } = vi.hoisted(() => ({
  captureExceptionSpy: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: captureExceptionSpy,
}));

import GlobalSegmentError from "./error";

beforeEach(() => {
  captureExceptionSpy.mockReset();
});

describe("app/error.tsx", () => {
  it("renders a calm, branded fallback with the headline copy", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<GlobalSegmentError error={error} reset={() => {}} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("reports the error to Sentry tagged 'error-boundary' on mount", () => {
    const error = new Error("kapow");
    render(<GlobalSegmentError error={error} reset={() => {}} />);
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: { component: "error-boundary" },
      }),
    );
  });

  it("invokes the framework-provided reset when the user clicks 'Try again'", () => {
    const reset = vi.fn();
    render(<GlobalSegmentError error={new Error("x")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
