/**
 * What the payment-plan calculator can price, in the order its dropdown lists
 * them.
 *
 * The project's starting price comes first and is the default: it is the
 * number every project publishes, and the one the hero and cards already
 * quote. After it, every unit type an editor has priced in the project's
 * "Units & layouts" card ("2 Bedroom · from AED 2.1M"), then each unit still
 * on sale in the inventory table. A visitor opening the section sees the
 * figure they came from, and can re-price the whole schedule against the
 * layout they actually want.
 *
 * Pure, and shared by the project page and the page builder's payment-plan
 * section, so a campaign page prices exactly what the project page does.
 */

export type CalculatorOptionKind = "starting" | "unitType" | "unit";

export type CalculatorUnit = {
  id: string;
  kind: CalculatorOptionKind;
  price_aed: number;
  /** Unit-type label, or the inventory row's type. Null for the starting price. */
  unitType: string | null;
  beds: number | null;
  /** Built-up area, or a unit type's smallest size. */
  builtUpFt2: number | null;
};

export type PricedUnitType = {
  id: string;
  label: string;
  beds: number | null;
  sizeFromFt2: number | null;
  priceFromAed: number | null;
};

export type PricedUnit = {
  id: string;
  unitType: string | null;
  beds: number | null;
  builtUpFt2: number | null;
  priceAed: number | null;
};

export function calculatorOptions({
  startingPrice,
  unitTypes,
  units,
}: {
  startingPrice: number | null;
  /** Enabled types, in the editor's order. Unpriced ones are skipped. */
  unitTypes: PricedUnitType[];
  /** Available inventory, in sort order. */
  units: PricedUnit[];
}): CalculatorUnit[] {
  const floor = startingPrice && startingPrice > 0 ? startingPrice : null;
  const out: CalculatorUnit[] = [];

  if (floor) {
    out.push({
      id: "starting-price",
      kind: "starting",
      price_aed: floor,
      unitType: null,
      beds: null,
      builtUpFt2: null,
    });
  }

  for (const t of unitTypes) {
    if (!t.priceFromAed || t.priceFromAed <= 0) continue;
    out.push({
      // Prefixed: a type and an inventory row are different tables, and the
      // dropdown's value has to tell them apart.
      id: `type-${t.id}`,
      kind: "unitType",
      price_aed: t.priceFromAed,
      unitType: t.label,
      beds: t.beds,
      builtUpFt2: t.sizeFromFt2,
    });
  }

  for (const u of units) {
    // A unit with no price is priced at the floor rather than at zero; one
    // with neither has nothing to calculate and is left out.
    const price = u.priceAed && u.priceAed > 0 ? u.priceAed : floor;
    if (!price) continue;
    out.push({
      id: `unit-${u.id}`,
      kind: "unit",
      price_aed: price,
      unitType: u.unitType,
      beds: u.beds,
      builtUpFt2: u.builtUpFt2,
    });
  }

  return out;
}
