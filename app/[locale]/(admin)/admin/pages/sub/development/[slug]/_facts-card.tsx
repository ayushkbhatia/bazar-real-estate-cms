"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  evaluateDevelopmentHeroFacts,
  parseHeroFactNumber,
} from "@/lib/schemas/development";
import { saveDevelopmentFacts } from "../_actions";

/**
 * The four stats the project hero renders: starting price, bedrooms, total
 * units, handover.
 *
 * They live on the `developments` row, not in the section document, so this
 * card writes the record directly — same reasoning as the images card next to
 * it. Before this existed the only way to set them was the record editor,
 * which is one click away and easy to miss, so projects created from the "new
 * project" form rendered "—" in all four hero slots.
 */
export function DevelopmentFactsCard({
  slug,
  startingPrice,
  bedroomsText,
  totalUnits,
  handoverDate,
  published,
}: {
  slug: string;
  startingPrice: number | null;
  bedroomsText: string | null;
  totalUnits: number | null;
  handoverDate: string | null;
  published: boolean;
}) {
  const router = useRouter();
  // A stored 0 seeds as blank. Zero means "not set" to the gate and to the
  // schemas, so showing it in the box would leave the editor staring at a
  // value the rest of the system calls missing.
  const seedNumber = (n: number | null) => (n != null && n > 0 ? String(n) : "");
  const [price, setPrice] = useState(seedNumber(startingPrice));
  const [beds, setBeds] = useState(bedroomsText ?? "");
  const [units, setUnits] = useState(seedNumber(totalUnits));
  const [handover, setHandover] = useState(handoverDate ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const dirty =
    price !== seedNumber(startingPrice) ||
    beds !== (bedroomsText ?? "") ||
    units !== seedNumber(totalUnits) ||
    handover !== (handoverDate ?? "");

  // Blank reads as null; unreadable reads as NaN, which the schema rejects
  // with a parse error rather than a misleading "required".
  // NaN collapses to null here: onSave rejects unreadable input before this
  // matters, and the warning banner should say "missing", not crash.
  const asNumber = (v: string): number | null => {
    const parsed = parseHeroFactNumber(v);
    return parsed === null || Number.isNaN(parsed) ? null : parsed;
  };

  // Evaluated against what is SAVED, not what is typed. The banner is a
  // statement about the live page ("this project renders — to visitors"), so
  // computing it from unsaved input would clear it the moment someone typed,
  // claiming the project was ready while the row still held nulls.
  const gate = evaluateDevelopmentHeroFacts({
    starting_price: startingPrice,
    bedrooms_text: bedroomsText,
    total_units: totalUnits,
    handover_date: handoverDate,
  });

  function onSave() {
    // Unreadable input is caught here rather than server-side: zod reports NaN
    // and null with the same message, so "6.2M" would come back as "required",
    // which is wrong — they did enter something, it just isn't a number.
    const unreadable: Record<string, string> = {};
    if (Number.isNaN(parseHeroFactNumber(price)))
      unreadable.starting_price = "Enter a number, e.g. 6200000.";
    if (Number.isNaN(parseHeroFactNumber(units)))
      unreadable.total_units = "Enter a whole number, e.g. 312.";
    if (Object.keys(unreadable).length > 0) {
      setErrors(unreadable);
      return;
    }

    setErrors({});
    startTransition(async () => {
      const result = await saveDevelopmentFacts(slug, {
        starting_price: asNumber(price),
        bedrooms_text: beds.trim() || null,
        total_units: asNumber(units),
        handover_date: handover.trim() || null,
      });
      if (result.status === "ok") {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
        if (result.fieldErrors) setErrors(result.fieldErrors);
      }
    });
  }

  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="me-auto">
          <h2 className="text-[13.5px] font-medium">Key facts</h2>
          <p className="text-[11.5px] text-bz-muted">
            The four stats across the bottom of the page hero. Save as you go —
            all four are required before the project can be published.
          </p>
        </div>
        {dirty ? (
          <span className="text-[11.5px] text-bz-muted">Unsaved changes</span>
        ) : null}
        <Button size="sm" onClick={onSave} disabled={pending || !dirty}>
          <Save size={13} strokeWidth={1.8} />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>

      {!gate.ok ? (
        <div className="flex items-start gap-2 rounded border border-[oklch(0.85_0.09_75)] bg-[oklch(0.97_0.03_75)] px-3 py-2">
          <AlertTriangle
            size={14}
            className="mt-0.5 shrink-0 text-[oklch(0.45_0.12_60)]"
          />
          <p className="text-[12px] text-[oklch(0.35_0.09_60)]">
            {published
              ? "This project is live and missing hero facts — it renders “—” to visitors."
              : "Fill these in to publish."}{" "}
            Missing: {gate.blockers.join(", ").toLowerCase()}.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          id="starting_price"
          label="Starting price (AED)"
          help="Shown as “AED 6.2M”. Enter the number only, e.g. 6200000."
          error={errors.starting_price}
        >
          <Input
            id="starting_price"
            inputMode="numeric"
            placeholder="6200000"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </Field>

        <Field
          id="bedrooms_text"
          label="Bedrooms"
          help="Free text, because ranges read better than a number — e.g. “1–4 bed”."
          error={errors.bedrooms_text}
        >
          <Input
            id="bedrooms_text"
            placeholder="1–4 bed"
            maxLength={40}
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
          />
        </Field>

        <Field
          id="total_units"
          label="Total units"
          help="Whole number of units in the project."
          error={errors.total_units}
        >
          <Input
            id="total_units"
            inputMode="numeric"
            placeholder="312"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
        </Field>

        <Field
          id="handover_date"
          label="Handover"
          help="The hero shows the quarter, e.g. “Q4 2027”."
          error={errors.handover_date}
        >
          <Input
            id="handover_date"
            type="date"
            value={handover}
            onChange={(e) => setHandover(e.target.value)}
          />
        </Field>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  help: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <span className="text-[12px] text-[oklch(0.45_0.13_28)]">{error}</span>
      ) : (
        <span className="text-[11.5px] text-bz-muted">{help}</span>
      )}
    </div>
  );
}
