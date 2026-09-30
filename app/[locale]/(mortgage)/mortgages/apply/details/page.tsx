import { createAdminClient } from "@/lib/supabase/admin";
import { PersonalDetails } from "../_steps/personal-details";

/** The design's figures, used when the setting can't be read (D23). */
const DEFAULT_LTV = { national: 85, expat: 80 };

/** W2 · Personal details (docs/mortgage/frontend/W2-personal-details). */
export default async function PersonalDetailsPage() {
  // "Up to 85% LTV" is a setting (D23), so the copy and the figure agree.
  let ltv = DEFAULT_LTV;
  const db = createAdminClient();
  if (db) {
    const { data } = await db
      .from("mortgage_settings")
      .select("ltv_national_pct, ltv_expat_pct")
      .eq("id", 1)
      .maybeSingle();
    if (data) ltv = { national: data.ltv_national_pct, expat: data.ltv_expat_pct };
  }
  return <PersonalDetails ltv={ltv} />;
}
