import { describe, expect, it, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/[locale]/(public)/_actions/forms", () => ({
  submitForm: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { FormRenderer } from "./form-renderer";
import { renderWithIntl } from "@/lib/i18n/test-utils";
import { defaultForm } from "@/lib/forms";

// The registry's Buy brief: every field full width, so one field per row —
// Full Name, Phone, Email, Purpose, then the folded rest.
const buy = () => defaultForm("buy_hero_enquiry")!;

function fold(container: HTMLElement) {
  return container.querySelector<HTMLElement>("[data-folded]");
}

describe("FormRenderer foldAfterRows", () => {
  it("shows the first rows and keeps the rest folded and inert", () => {
    const { container } = renderWithIntl(
      <FormRenderer form={buy()} foldAfterRows={4} />,
    );
    const folded = fold(container);
    expect(folded).not.toBeNull();
    expect(folded!.hasAttribute("inert")).toBe(true);
    expect(folded!.contains(container.querySelector('[name="message"]'))).toBe(
      true,
    );
    expect(folded!.contains(container.querySelector('[name="name"]'))).toBe(
      false,
    );
  });

  it("unfolds on the visitor's first answer", async () => {
    const user = userEvent.setup();
    const { container } = renderWithIntl(
      <FormRenderer form={buy()} foldAfterRows={4} />,
    );
    await user.type(container.querySelector('[name="name"]')!, "A");
    expect(fold(container)).toBeNull();
  });

  it("stays folded through the slider's untouched report on mount", async () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWithIntl(
        <FormRenderer form={buy()} foldAfterRows={4} />,
      );
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(fold(container)).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unfolds on submit, so an error below the fold is on screen", async () => {
    const user = userEvent.setup();
    const { container } = renderWithIntl(
      <FormRenderer form={buy()} foldAfterRows={4} />,
    );
    await user.click(screen.getByRole("button", { name: "Find My Property" }));
    expect(fold(container)).toBeNull();
  });

  it("renders every row unfolded without the prop", () => {
    const { container } = renderWithIntl(<FormRenderer form={buy()} />);
    expect(fold(container)).toBeNull();
    expect(container.querySelector("[inert]")).toBeNull();
  });
});
