import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setArabicMock = vi.fn(async () => ({ status: "ok" as const }));
vi.mock("./_actions", () => ({
  toggleAmenityActive: vi.fn(),
  createAmenity: vi.fn(),
  setAmenityArabic: (...args: unknown[]) => setArabicMock(...(args as [])),
}));

import { AmenityArabicField } from "./_form";

/**
 * The row-level Arabic box. It saves on blur rather than behind a button
 * because the job it exists for is a pass down a 104-row list, and a Save
 * click per row would triple it.
 */
beforeEach(() => setArabicMock.mockClear());

describe("AmenityArabicField", () => {
  it("saves what was typed when the box loses focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AmenityArabicField code="sea_vieww" initial={null} suggestion={null} />
        <button type="button">elsewhere</button>
      </>,
    );

    await user.type(
      screen.getByLabelText("Arabic for sea_vieww"),
      "إطلالة على البحر",
    );
    await user.click(screen.getByRole("button", { name: "elsewhere" }));

    await waitFor(() =>
      expect(setArabicMock).toHaveBeenCalledWith(
        "sea_vieww",
        "إطلالة على البحر",
      ),
    );
  });

  it("does not write when the value is unchanged", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AmenityArabicField
          code="sea_vieww"
          initial="إطلالة على البحر"
          suggestion={null}
        />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByLabelText("Arabic for sea_vieww"));
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(setArabicMock).not.toHaveBeenCalled();
  });

  it("offers the store's word as a placeholder, and adopts it on request", async () => {
    // A placeholder rather than a pre-filled value: the public page falls back
    // to the store anyway, so pre-filling would make an editor think they had
    // checked a word they never saw.
    const user = userEvent.setup();
    render(
      <AmenityArabicField
        code="basement"
        initial={null}
        suggestion="باصنت"
      />,
    );
    const input = screen.getByLabelText("Arabic for basement") as HTMLInputElement;
    expect(input.placeholder).toBe("باصنت");
    expect(input.value).toBe("");

    await user.click(screen.getByRole("button", { name: "use" }));
    await waitFor(() =>
      expect(setArabicMock).toHaveBeenCalledWith("basement", "باصنت"),
    );
  });

  it("puts the saved value back on Escape", async () => {
    const user = userEvent.setup();
    render(
      <AmenityArabicField code="gym" initial="صالة رياضية" suggestion={null} />,
    );
    const input = screen.getByLabelText("Arabic for gym") as HTMLInputElement;
    await user.clear(input);
    await user.type(input, "خطأ{Escape}");
    expect(input.value).toBe("صالة رياضية");
    expect(setArabicMock).not.toHaveBeenCalled();
  });
});
