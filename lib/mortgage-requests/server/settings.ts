import type { SupabaseClient } from "@supabase/supabase-js";
import { slaPolicy, type SlaPolicy, type WorkingHoursSetting } from "../sla";

/** The `mortgage_settings` row, as the server code reads it. */
export type MortgageSettings = {
  flag: "off" | "staff" | "public";
  assignment_mode: "round_robin" | "claim";
  sla_budget_minutes: number;
  sla_risk_minutes: number;
  working_hours: WorkingHoursSetting;
  consultation_minutes: number;
  slot_grid_minutes: number;
  link_expiry_days: number;
  ltv_national_pct: number;
  ltv_expat_pct: number;
};

export type MortgageHoliday = { day: string; name: string };

export type LoadedSettings = {
  settings: MortgageSettings;
  holidays: MortgageHoliday[];
  /** The 24-hour promise's policy: the one input every sla.ts call takes. */
  policy: SlaPolicy;
};

const COLUMNS =
  "flag, assignment_mode, sla_budget_minutes, sla_risk_minutes, working_hours, consultation_minutes, slot_grid_minutes, link_expiry_days, ltv_national_pct, ltv_expat_pct";

/**
 * The module's settings and holidays, and the promise's policy built from
 * them. Works with the service role (the submit, the SLA tick) and with a
 * team member's own session (the CMS), whose RLS lets them read both.
 */
export async function loadMortgageSettings(db: SupabaseClient): Promise<LoadedSettings> {
  const [settings, holidays] = await Promise.all([
    db.from("mortgage_settings").select(COLUMNS).eq("id", 1).single(),
    db.from("mortgage_holidays").select("day, name").order("day"),
  ]);
  if (settings.error) throw new Error(`settings read failed: ${settings.error.message}`);
  if (holidays.error) throw new Error(`holidays read failed: ${holidays.error.message}`);
  const row = settings.data as unknown as MortgageSettings;
  const days = holidays.data as MortgageHoliday[];
  return {
    settings: row,
    holidays: days,
    policy: slaPolicy(row, days.map((h) => h.day)),
  };
}
