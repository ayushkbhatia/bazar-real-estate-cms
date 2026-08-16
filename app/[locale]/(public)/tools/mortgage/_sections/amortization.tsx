"use client";

import { useTranslations } from "next-intl";
import { useIsRtl } from "@/lib/dom/use-is-rtl";
import { amortizationByYear } from "@/lib/mortgage";
import { ToolSection, fillYears, type SectionCopy } from "./shared";

type Props = {
  copy: SectionCopy;
  schedule: ReturnType<typeof amortizationByYear>;
  termYears: number;
};

/**
 * The year-by-year split of principal against interest.
 *
 * The eyebrow carries the term, so its stored string is a template — see
 * `fillYears`. Everything else is the chart, which was already its own
 * component and moves here whole.
 */
export function AmortizationSection({ copy, schedule, termYears }: Props) {
  const t = useTranslations("tools");
  return (
    <ToolSection
      copy={{ ...copy, eyebrow: fillYears(copy.eyebrow, termYears) }}
      testId="amortization-section"
    >
      <div className="border border-bz-border bg-bz-surface rounded-lg p-6 md:p-7">
        <div className="flex justify-end gap-3 text-[12px] mb-5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-bz-ink" />
            {t("mortgage.amortPrincipal")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-bz-accent" />
            {t("mortgage.amortInterest")}
          </span>
        </div>
        <AmortChart schedule={schedule} termYears={termYears} />
      </div>
    </ToolSection>
  );
}

function AmortChart({
  schedule,
  termYears,
}: {
  schedule: ReturnType<typeof amortizationByYear>;
  termYears: number;
}) {
  const t = useTranslations("tools");
  const rtl = useIsRtl();
  if (schedule.length === 0) {
    return (
      <p className="text-[13px] text-bz-muted">{t("mortgage.amortEmpty")}</p>
    );
  }
  const maxTotal = Math.max(
    ...schedule.map((r) => r.principalAed + r.interestAed),
  );
  const W = 800;
  const H = 220;
  const padding = 4;
  const colW = (W - padding * 2) / schedule.length;
  const innerW = colW * 0.82;

  return (
    <>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        aria-label={t("mortgage.amortAria")}
      >
        {[40, 80, 120, 160, 200].map((y) => (
          <line
            key={y}
            x1={0}
            x2={W}
            y1={y}
            y2={y}
            stroke="var(--bz-border)"
            strokeDasharray="2 4"
          />
        ))}
        {schedule.map((row, i) => {
          const total = row.principalAed + row.interestAed;
          const h = (total / maxTotal) * 160; // bar fits into 160px tall area
          const pH = total === 0 ? 0 : h * (row.principalAed / total);
          const iH = h - pH;
          // Mirror the time axis in RTL so the series runs right-to-left,
          // the way a chronology reads in Arabic.
          //
          // This is a correctness fix, not a stylistic one. The label row
          // below is HTML flex and reverses with `dir`; the SVG does not.
          // Left alone the two disagree, and "Y25" ends up sitting over Y1's
          // interest-heavy bar — the chart states the opposite of the truth.
          const x = rtl
            ? W - padding - (i + 1) * colW + (colW - innerW) / 2
            : padding + i * colW + (colW - innerW) / 2;
          const baseY = 200;
          return (
            <g key={i}>
              <rect
                x={x}
                y={baseY - h}
                width={innerW}
                height={iH}
                fill="var(--bz-accent)"
              />
              <rect
                x={x}
                y={baseY - pH}
                width={innerW}
                height={pH}
                fill="var(--bz-ink)"
              />
            </g>
          );
        })}
        <line x1={0} x2={W} y1={200} y2={200} stroke="var(--bz-ink)" />
      </svg>
      <div className="flex justify-between text-[11px] text-bz-muted mt-1">
        {[
          1,
          Math.round(termYears * 0.25) || 1,
          Math.round(termYears * 0.5) || 1,
          Math.round(termYears * 0.75) || 1,
          termYears,
        ].map((year, i) => (
          <span key={i}>{t("mortgage.amortYear", { year })}</span>
        ))}
      </div>
    </>
  );
}
