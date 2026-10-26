import type { Database } from "@/db/types";
import { isSaleMode } from "@/lib/schemas/property";

type PropertyForm = Database["public"]["Enums"]["property_form"];
type PropertyMode = Database["public"]["Enums"]["property_mode"];

export type PublishabilityInput = {
  status: string;
  /** Optional so callers that don't track the developer (e.g. the bulk-publish
   *  path) are unaffected; the gate only applies when a value is supplied. */
  has_developer?: boolean;
  /** The listing's type does not need a developer (land, hotel apartment and
   *  the commercial types — lib/properties/type-rules.ts), so "No developer"
   *  passes. */
  developer_optional?: boolean;
  /** Area columns the listing's type requires and it lacks (`missingAreas`
   *  in lib/properties/type-rules.ts). Optional, like `has_developer`: the
   *  bulk path supplies nothing and is unaffected. */
  missing_areas?: ("built_up_ft2" | "plot_ft2")[];
  /** Optional pair, same precedent as `has_developer`: the sale-form check
   *  only runs when the caller supplies BOTH values. The bulk path selects
   *  neither column, so it is unaffected. */
  mode?: PropertyMode;
  property_form?: PropertyForm | null;
  listing_permit_no: string | null;
  listing_permit_expires_at: string | null; // ISO date
  slug: string | null;
  title: string | null;
  price_aed: number | null;
  /** Override "now" for testing. */
  now?: Date;
};

export type PublishabilityResult = {
  ok: boolean;
  blockers: string[];
  /** A short, ordered list of pre-flight checks for display in the UI. */
  checks: { label: string; passed: boolean }[];
};

/**
 * Pure pre-flight check. Anything in `blockers` will be returned to the
 * caller as a reason the property cannot be published.
 *
 * The same checks are mirrored in `checks[]` for UI rendering.
 *
 * The gate deliberately does NOT cover the paperwork flags on
 * `properties.compliance` (Form A / title deed / NOC / power of attorney) or
 * the presence of a hero image: those are chased outside the CMS and were
 * blocking listings that were otherwise ready to go live. The column is still
 * there — it just doesn't gate publishing.
 */
export function evaluatePublishability(
  input: PublishabilityInput,
): PublishabilityResult {
  const now = input.now ?? new Date();
  const blockers: string[] = [];
  const checks: { label: string; passed: boolean }[] = [];

  if (input.has_developer !== undefined) {
    if (input.has_developer !== true && input.developer_optional === true) {
      checks.push({
        label: "No developer (not needed for this type)",
        passed: true,
      });
    } else {
      const developerPassed = input.has_developer === true;
      checks.push({ label: "Developer is set", passed: developerPassed });
      if (!developerPassed) blockers.push("Developer is missing");
    }
  }

  if (input.missing_areas !== undefined) {
    const missingBuiltUp = input.missing_areas.includes("built_up_ft2");
    const missingPlot = input.missing_areas.includes("plot_ft2");
    checks.push({
      label: "Areas this type needs are filled in",
      passed: !missingBuiltUp && !missingPlot,
    });
    if (missingBuiltUp) blockers.push("Built-up area is missing");
    if (missingPlot) blockers.push("Plot size is missing");
  }

  // A sale listing with no form belongs to none of /buy/ready, /buy/resale or
  // the off-plan facet — it would publish and then be invisible on all three.
  // Rentals must keep the column NULL (DB check
  // `properties_form_rent_null_ck`), so they are not gated here.
  if (input.mode !== undefined && input.property_form !== undefined) {
    if (isSaleMode(input.mode)) {
      const formPassed = input.property_form != null;
      checks.push({ label: "Sale form is set", passed: formPassed });
      if (!formPassed)
        blockers.push(
          "Sale form is missing — set it to Off-plan, Ready (new) or Resale in the Overview tab, or the listing shows on none of /buy/ready, /buy/resale or the off-plan facet",
        );
    }
  }

  const titlePassed = !!(input.title && input.title.trim().length >= 3);
  checks.push({ label: "Title is set", passed: titlePassed });
  if (!titlePassed) blockers.push("Title is missing");

  const slugPassed = !!(input.slug && /^[a-z0-9-]{3,}$/.test(input.slug));
  checks.push({ label: "URL slug is valid", passed: slugPassed });
  if (!slugPassed) blockers.push("Slug is missing or invalid");

  const pricePassed = typeof input.price_aed === "number" && input.price_aed > 0;
  checks.push({ label: "Price is set", passed: pricePassed });
  if (!pricePassed) blockers.push("Price is missing or zero");

  const permitNoPassed =
    !!input.listing_permit_no && input.listing_permit_no.trim().length > 0;
  checks.push({ label: "Listing permit no. is recorded", passed: permitNoPassed });
  if (!permitNoPassed) blockers.push("Listing permit number is missing");

  const permitExpiryPassed = (() => {
    const raw = input.listing_permit_expires_at;
    if (!raw) return false;
    // Compare date-to-date, not date-to-timestamp: a permit is valid through
    // its whole expiry day. Date.parse("YYYY-MM-DD") is UTC midnight, which
    // would fail against a mid-day `now` on the expiry day itself.
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) return false;
    const expiry = new Date(y, m - 1, d).getTime();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return expiry >= today;
  })();
  checks.push({
    label: "Listing permit not expired",
    passed: permitExpiryPassed,
  });
  if (!permitExpiryPassed)
    blockers.push("Listing permit expires_at is missing or in the past");

  return { ok: blockers.length === 0, blockers, checks };
}
