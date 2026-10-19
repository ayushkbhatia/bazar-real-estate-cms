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
import { HONEYPOT_FIELD } from "@/lib/forms/spam";
import { submitForm } from "@/app/[locale]/(public)/_actions/forms";

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

describe("FormRenderer honeypot", () => {
  it("renders a trap no browser autofill recognises", () => {
    const { container } = renderWithIntl(<FormRenderer form={buy()} />);
    const trap = container.querySelector<HTMLInputElement>(
      `[name="${HONEYPOT_FIELD}"]`,
    );
    expect(trap).not.toBeNull();
    // The old `_company_url` was filled by Chrome's and Safari's autofill,
    // and every lead that did so was discarded.
    expect(container.querySelector('[name="_company_url"]')).toBeNull();
    expect(trap!.getAttribute("data-1p-ignore")).not.toBeNull();
    expect(trap!.getAttribute("data-lpignore")).toBe("true");
  });
});

describe("FormRenderer when the server action fails", () => {
  const band = () => defaultForm("buy_lead_band")!;

  async function fillAndSubmit(container: HTMLElement) {
    const user = userEvent.setup();
    const inputs = container.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("input[name], textarea[name]");
    for (const el of inputs) {
      if (el.name.startsWith("_")) continue;
      if (el.type === "checkbox" || el.type === "range") continue;
      const value =
        el.type === "email"
          ? "visitor@example.com"
          : el.type === "tel" || el.name.includes("phone")
            ? "501234567"
            : "Test Visitor";
      await user.type(el, value);
    }
    await user.click(container.querySelector('[type="submit"]')!);
  }

  it("retries through /api/forms/<key> and files the lead", async () => {
    vi.mocked(submitForm).mockRejectedValueOnce(
      new Error('Server Action "abc" was not found on the server.'),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ status: "ok", enquiryId: "e1" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = renderWithIntl(<FormRenderer form={band()} />);
      await fillAndSubmit(container);
      await vi.waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          "/api/forms/buy_lead_band",
          expect.objectContaining({ method: "POST" }),
        ),
      );
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
      expect(body.values.email).toBe("visitor@example.com");
      await vi.waitFor(() =>
        expect(container.querySelector("form")).toBeNull(),
      );
    } finally {
      vi.unstubAllGlobals();
      warn.mockRestore();
    }
  });

  it("says so, instead of doing nothing, when both ways fail", async () => {
    vi.mocked(submitForm).mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { container } = renderWithIntl(<FormRenderer form={band()} />);
      await fillAndSubmit(container);
      expect(
        await screen.findByText(/Something went wrong sending that/),
      ).toBeTruthy();
      // The answers are still there to send again.
      expect(
        container.querySelector<HTMLInputElement>('input[type="email"]')!
          .value,
      ).toBe("visitor@example.com");
    } finally {
      vi.unstubAllGlobals();
      warn.mockRestore();
    }
  });
});
