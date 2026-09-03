"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AREA_UNITS,
  CURRENCIES,
  UNIT_LABELS_AR,
  UNIT_LABELS_EN,
  formatArea,
  formatPrice,
  resolveUnitLabels,
  type AreaUnit,
  type Currency,
  type UnitLabelSettings,
} from "@/lib/preferences";
import { updateUnitLabels } from "./_actions";

/**
 * /admin/settings/units — the words every price and every area is written with.
 *
 * WHY THIS SCREEN EXISTS
 *
 * "AED" and "ft²" used to be constants in `lib/preferences/types.ts`. On an
 * English site that was invisible and fine. On `/ar` it meant a card whose
 * headline, beds, baths and location had all been translated and whose price
 * still said AED — and nothing reported it, because the translation pipeline
 * deliberately protects those two tokens inside an editor's prose.
 *
 * WHAT IT IS NOT
 *
 * It is not a currency editor. Nothing here changes what a property costs, what
 * gets stored, what a search URL means, or the AED→USD rate — those are numbers
 * and they are elsewhere. Every box on this page changes one WORD.
 *
 * ARABIC ONLY, for now. English has one right answer per unit and it is the one
 * the site ships with; the storage format is keyed by locale, so an English
 * column can be added later without a migration. The English values are shown
 * beside each box, read-only, because the useful question when typing an Arabic
 * label is "what is this replacing".
 */

const CURRENCY_HELP: Record<Currency, string> = {
  AED: "Everything on the site is priced in dirhams, so this is the word an Arabic visitor sees most.",
  USD: "Only shown to a visitor who has switched the currency toggle to dollars.",
};

const AREA_HELP: Record<AreaUnit, string> = {
  ft2: "The unit every area is stored in, and the site's default.",
  m2: "Shown to a visitor who has switched the area toggle to metres.",
};

type Row = {
  group: "currency" | "currencyLong" | "area" | "areaLong";
  key: string;
  label: string;
  english: string;
  help?: string;
};

export function UnitLabelsForm({ initial }: { initial: UnitLabelSettings }) {
  const [values, setValues] = useState<UnitLabelSettings>(initial);
  const [pending, start] = useTransition();

  const ar = values.ar ?? {};

  function set(group: Row["group"], key: string, value: string) {
    setValues((v) => ({
      ...v,
      ar: {
        ...(v.ar ?? {}),
        [group]: { ...((v.ar ?? {})[group] ?? {}), [key]: value },
      },
    }));
  }

  function get(group: Row["group"], key: string): string {
    const bag = ar[group] as Record<string, string | undefined> | undefined;
    return bag?.[key] ?? "";
  }

  /**
   * The specimen renders through the SAME formatters the public site uses,
   * fed by the same resolver, so it cannot flatter the values being typed. It
   * is also where the ordering rule becomes visible without being explained:
   * English puts the currency before the figure and Arabic after it, and an
   * operator sees that happen rather than reading a paragraph about it.
   */
  const preview = useMemo(() => {
    const labels = resolveUnitLabels("ar", values);
    return {
      price: formatPrice(4_250_000, { currency: "AED", labels }),
      priceUsd: formatPrice(4_250_000, { currency: "USD", labels }),
      areaFt2: formatArea(2340, { area_unit: "ft2", labels }),
      areaM2: formatArea(2340, { area_unit: "m2", labels }),
    };
  }, [values]);

  const sections: { title: string; note: string; rows: Row[] }[] = [
    {
      title: "Currency",
      note: "The token beside a figure — on a card, in a filter box, in the price header of a listing.",
      rows: CURRENCIES.map((c) => ({
        group: "currency" as const,
        key: c,
        label: c,
        english: UNIT_LABELS_EN.currency[c],
        help: CURRENCY_HELP[c],
      })),
    },
    {
      title: "Area unit",
      note: "The glyph after every area on the site. Kept short: it sits inside a card that has one line for it.",
      rows: AREA_UNITS.map((u) => ({
        group: "area" as const,
        key: u,
        label: u === "ft2" ? "Square feet" : "Square metres",
        english: UNIT_LABELS_EN.area[u],
        help: AREA_HELP[u],
      })),
    },
    {
      title: "Spelled-out names",
      note: "Only the display-preferences menu renders these — the place a visitor chooses between the two, where there is room for a full name.",
      rows: [
        ...CURRENCIES.map((c) => ({
          group: "currencyLong" as const,
          key: c,
          label: `${c} — full name`,
          english: UNIT_LABELS_EN.currencyLong[c],
        })),
        ...AREA_UNITS.map((u) => ({
          group: "areaLong" as const,
          key: u,
          label: `${u === "ft2" ? "Square feet" : "Square metres"} — full name`,
          english: UNIT_LABELS_EN.areaLong[u],
        })),
      ],
    },
  ];

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await updateUnitLabels(values);
      if (res.status === "ok") toast.success(res.message ?? "Saved.");
      else toast.error(res.message);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8 max-w-3xl">
      <header>
        <h1 className="serif text-[26px] leading-tight">Units &amp; currency</h1>
        <p className="mt-2 text-[13.5px] text-bz-ink-2 leading-relaxed">
          The words the Arabic site writes prices and areas with. Nothing here
          changes a price, a stored value or an exchange rate — only the word
          printed beside the number. Leave a box empty to use the word the site
          ships with.
        </p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-bz-ink">
              {section.title}
            </h2>
            <p className="mt-1 text-[12.5px] text-bz-muted leading-relaxed">
              {section.note}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {section.rows.map((row) => {
              const id = `unit-${row.group}-${row.key}`;
              const shipped =
                row.group === "currency"
                  ? UNIT_LABELS_AR.currency[row.key as Currency]
                  : row.group === "currencyLong"
                    ? UNIT_LABELS_AR.currencyLong[row.key as Currency]
                    : row.group === "area"
                      ? UNIT_LABELS_AR.area[row.key as AreaUnit]
                      : UNIT_LABELS_AR.areaLong[row.key as AreaUnit];
              return (
                <div
                  key={id}
                  className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-2 sm:gap-4 sm:items-start"
                >
                  <div className="pt-1.5">
                    <Label htmlFor={id} className="text-[13px]">
                      {row.label}
                    </Label>
                    <div className="mono text-[11.5px] text-bz-muted mt-0.5">
                      {row.english}
                    </div>
                  </div>
                  <div>
                    <Input
                      id={id}
                      dir="rtl"
                      lang="ar"
                      value={get(row.group, row.key)}
                      placeholder={shipped}
                      maxLength={40}
                      onChange={(e) =>
                        set(row.group, row.key, e.target.value)
                      }
                    />
                    {row.help ? (
                      <p className="mt-1 text-[12px] text-bz-muted leading-snug">
                        {row.help}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
        <div className="eyebrow">Arabic preview</div>
        <p className="mt-1 text-[12.5px] text-bz-muted leading-relaxed">
          Rendered by the same formatters the public site uses. Note that Arabic
          puts the currency after the figure — that is fixed, and not something
          this screen sets.
        </p>
        <ul
          dir="rtl"
          lang="ar"
          className="mt-3 flex flex-col gap-1.5 text-[15px] text-bz-ink"
        >
          <li>{preview.price}</li>
          <li>{preview.priceUsd}</li>
          <li>{preview.areaFt2}</li>
          <li>{preview.areaM2}</li>
        </ul>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Saving…
            </>
          ) : (
            "Save labels"
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => setValues({})}
        >
          Reset to shipped words
        </Button>
      </div>
    </form>
  );
}
