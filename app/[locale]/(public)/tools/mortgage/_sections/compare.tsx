"use client";

import { useTranslations } from "next-intl";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import type { Preferences } from "@/lib/preferences";
import { ToolSection, money, type SectionCopy } from "./shared";

export type ScenarioCard = {
  key: string;
  name: string;
  sub: string;
  monthly: number;
  total: number;
  active: boolean;
};

type Props = {
  copy: SectionCopy;
  prefs: Preferences;
  scenarios: ScenarioCard[];
};

/** The same deal with one variable moved — more down, or a shorter term. */
export function CompareSection({ copy, prefs, scenarios }: Props) {
  const t = useTranslations("tools");

  return (
    <ToolSection copy={copy} testId="compare-section">
      <div className="grid sm:grid-cols-3 gap-3" data-testid="scenarios">
        {scenarios.map((s) => (
          <div
            key={s.key}
            className={cn(
              "rounded-lg p-5",
              s.active
                ? "bg-bz-navy text-white"
                : "bg-bz-surface border border-bz-border text-bz-ink",
            )}
          >
            <div className="flex justify-between items-center">
              <Eyebrow className={s.active ? "text-white/70" : undefined}>
                {s.name}
              </Eyebrow>
              {s.active ? (
                <span className="w-2 h-2 rounded-full bg-bz-success" />
              ) : null}
            </div>
            <p
              className={cn(
                "text-[11px] mt-1",
                s.active ? "text-white/65" : "text-bz-muted",
              )}
            >
              {s.sub}
            </p>
            <div
              className={cn(
                "serif text-[24px] mt-3.5",
                !s.active && "text-bz-navy",
              )}
              style={{ letterSpacing: "-0.015em" }}
            >
              {t("mortgage.scenarioMonthly", {
                amount: money(s.monthly, prefs),
              })}
            </div>
            <div
              className={cn(
                "mono text-[11.5px] mt-1",
                s.active ? "text-white/70" : "text-bz-muted",
              )}
            >
              {t("mortgage.scenarioTotal", { amount: money(s.total, prefs) })}
            </div>
          </div>
        ))}
      </div>
    </ToolSection>
  );
}
