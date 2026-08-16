"use client";

import { useTranslations } from "next-intl";

/**
 * Sprint 5b: DBR (debt-burden ratio) gauge. UAE central-bank guideline is
 * <= 50%; mortgage stress tests typically aim <= 35%. The arc itself is
 * static SVG; the component is a Client Component only because its parent
 * (`mortgage-calculator.tsx`) is, and it reads the same route-scoped `tools`
 * bag mounted by `tools/layout.tsx`.
 */

/**
 * Three decimal places on a 200-unit-wide viewBox — under a thousandth of a
 * pixel at any size this renders at, so nothing moves.
 *
 * The rounding is not cosmetic. `Math.sin` and `Math.cos` are not required to
 * be correctly rounded, so Node and the browser can disagree in the last
 * significant digit (43.6051415340002 against 43.60514153400021), and that
 * digit reaches the DOM inside the path's `d` string. React compares the
 * attribute, finds the two spellings different, and logs a hydration mismatch
 * on every load of /tools/mortgage. Quantising here means both engines have to
 * be off by more than a thousandth before the strings can differ at all.
 */
function coord(n: number): string {
  return n.toFixed(3);
}

export function DbrGauge({
  monthlyPaymentAed,
  monthlyIncomeAed,
  maxDbr = 0.5,
}: {
  monthlyPaymentAed: number;
  monthlyIncomeAed: number;
  /**
   * The Central Bank cap, from Settings → Mortgage. The 0.35 band below it is
   * the lenders' stress-test convention rather than a regulator's number, so
   * it stays in code — `affordability()` carries the editable comfort line.
   */
  maxDbr?: number;
}) {
  const t = useTranslations("tools");
  const dbr =
    monthlyIncomeAed > 0
      ? Math.min(1.5, monthlyPaymentAed / monthlyIncomeAed)
      : 0;
  const pct = Math.round(dbr * 100);

  // Half-circle gauge. SVG coords: 200 wide, 100 tall, arc from (10, 100) → (190, 100).
  const radius = 90;
  const cx = 100;
  const cy = 100;
  // The fraction we sweep maps 0% → 0deg, 50% → 90deg, 100% → 180deg (capped).
  const angle = Math.min(180, dbr * 180);
  const rad = (angle - 180) * (Math.PI / 180);
  const endX = cx + radius * Math.cos(rad);
  const endY = cy + radius * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;

  const band =
    dbr <= 0.35
      ? { key: "dbrComfortable", color: "var(--bz-success, oklch(0.55 0.14 145))" }
      : dbr <= maxDbr
        ? { key: "dbrWithinLimit", color: "var(--bz-warning, oklch(0.7 0.13 65))" }
        : { key: "dbrOverLimit", color: "var(--bz-danger, oklch(0.5 0.18 25))" };

  return (
    <div className="rounded-lg border border-bz-border bg-bz-surface p-6">
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {t("mortgage.dbrTitle")}
      </div>
      <div className="mt-4 grid grid-cols-[200px_1fr] gap-6 items-center">
        <svg
          viewBox="0 0 200 110"
          aria-label={t("mortgage.dbrAria", { pct })}
          className="w-full"
        >
          {/* Track */}
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            stroke="var(--bz-border, oklch(0.9 0.005 80))"
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d={`M 10 100 A 90 90 0 ${largeArc} 1 ${coord(endX)} ${coord(endY)}`}
            stroke={band.color}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
          />
          {/* Center label */}
          <text
            x={100}
            y={85}
            textAnchor="middle"
            fontSize="28"
            fontWeight="500"
            fill="var(--bz-ink, #13110f)"
            style={{ fontFamily: "var(--bz-font-mono, ui-monospace)" }}
          >
            {pct}%
          </text>
        </svg>
        <div>
          <div
            className="text-[13px] font-medium"
            style={{ color: band.color }}
          >
            {t(`mortgage.${band.key}`)}
          </div>
          {/*
            The two figures used to be wrapped in `.mono` spans. Splicing a
            translated sentence around two fixed JSX children makes the Arabic
            word order unexpressible — the caps have to be able to move — so
            the sentence is one message and the numerals lose the mono face.
            Decoration on one paragraph, against a sentence that can be
            translated at all.
          */}
          <p className="mt-2 text-[12.5px] text-bz-muted leading-relaxed">
            {t("mortgage.dbrExplainer", { cap: Math.round(maxDbr * 100) })}
          </p>
        </div>
      </div>
    </div>
  );
}
