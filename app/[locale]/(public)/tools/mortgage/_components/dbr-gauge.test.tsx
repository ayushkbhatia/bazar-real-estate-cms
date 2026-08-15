import { describe, it, expect } from "vitest";
import { renderWithIntl } from "@/lib/i18n/test-utils";
import { DbrGauge } from "./dbr-gauge";

// `tools` is route-scoped rather than global (see `ROUTE_NAMESPACES`), so the
// harness is told about it here the same way `tools/layout.tsx` tells the
// browser about it.
const render = (ui: React.ReactElement) =>
  renderWithIntl(ui, { namespaces: ["tools"] });

/**
 * The arc is drawn from `Math.sin` / `Math.cos`, which the spec does not
 * require to be correctly rounded. Node and the browser can therefore disagree
 * in the last significant digit, and because the coordinates are interpolated
 * into the path's `d` string, that digit reaches the DOM — where React compares
 * the two spellings and reports a hydration mismatch.
 *
 * So the guarantee under test is about the *shape of the string*, not the
 * geometry: every coordinate is quantised before it is written, which is what
 * makes the two engines agree.
 */
function filledArc(container: HTMLElement): string {
  // Two paths: the grey track, then the coloured fill.
  const paths = container.querySelectorAll("path");
  return paths[1]!.getAttribute("d")!;
}

const QUANTISED = /^M 10 100 A 90 90 0 [01] 1 \d+\.\d{3} \d+\.\d{3}$/;

describe("<DbrGauge> arc precision", () => {
  it("writes both coordinates at a fixed three decimal places", () => {
    // 22% — the calculator's default scenario, and the case that was logging
    // the mismatch in production.
    const { container } = render(
      <DbrGauge monthlyPaymentAed={17_065} monthlyIncomeAed={79_166.67} />,
    );
    expect(filledArc(container)).toMatch(QUANTISED);
  });

  it("keeps the precision at every band, including the caps", () => {
    // 0% (no income), the two band thresholds, 100%, and past the 150% clamp.
    const income = 10_000;
    for (const payment of [0, 3_500, 5_000, 10_000, 20_000]) {
      const { container } = render(
        <DbrGauge monthlyPaymentAed={payment} monthlyIncomeAed={income} />,
      );
      expect(filledArc(container), `payment ${payment}`).toMatch(QUANTISED);
    }
    const { container } = render(
      <DbrGauge monthlyPaymentAed={5_000} monthlyIncomeAed={0} />,
    );
    expect(filledArc(container), "no income").toMatch(QUANTISED);
  });

  it("still lands on the arc's far end when the ratio is capped", () => {
    // Quantising must not move the drawing. At the 180° cap the sweep ends at
    // (190, 100) — the same point the grey track ends at.
    const { container } = render(
      <DbrGauge monthlyPaymentAed={20_000} monthlyIncomeAed={10_000} />,
    );
    expect(filledArc(container)).toBe("M 10 100 A 90 90 0 0 1 190.000 100.000");
  });
});
