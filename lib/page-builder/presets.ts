/**
 * Starting layouts.
 *
 * A preset is nothing but an ordered list of block keys — no storage, no
 * schema, no migration. It exists because the difference between a tool a
 * marketing manager uses weekly and one they use once is whether the first
 * screen is a blank page or a page that already looks like the campaign.
 */

import { getBlockDef, newBlockInstance } from "./catalogue";
import type { BlockInstance } from "./types";

export type PresetKey =
  | "blank"
  | "off_plan_launch"
  | "project_launch"
  | "area_campaign"
  | "lead_gen";

export type Preset = {
  key: PresetKey;
  label: string;
  description: string;
  blocks: string[];
};

export const PRESETS: Preset[] = [
  {
    key: "blank",
    label: "Blank",
    description: "Start with nothing and add sections yourself.",
    blocks: [],
  },
  {
    key: "off_plan_launch",
    label: "Off-plan launch",
    description:
      "A project launch: photographic hero, the projects themselves, the detail, the questions, the form.",
    blocks: [
      "hero_media",
      "featured_developments",
      "feature_scroll",
      "faq",
      "form_band",
    ],
  },
  {
    key: "project_launch",
    label: "Project launch",
    description:
      "One project, told the way its own page tells it: the figures, the payment plan, the master plan, the floor plans and the map — then the form. Pick the project once and every section follows it.",
    blocks: [
      "hero_media",
      "project_facts",
      "project_payment_plan",
      "project_master_plan",
      "project_unit_plans",
      "project_location",
      "form_band",
    ],
  },
  {
    key: "area_campaign",
    label: "Area campaign",
    description:
      "A community push: hero, live inventory, who Bazar is, and a closing call to action.",
    blocks: ["hero_media", "featured_properties", "about_bazar", "cta_band"],
  },
  {
    key: "lead_gen",
    label: "Lead generation",
    description:
      "Form-first: the brief above the fold, then the case for filling it in.",
    blocks: ["hero_form", "why_band", "steps", "faq"],
  },
];

export function getPreset(key: string): Preset | null {
  return PRESETS.find((p) => p.key === key) ?? null;
}

/** Whether a preset holds any section that shows one project. */
export function presetNeedsProject(key: string): boolean {
  return (getPreset(key)?.blocks ?? []).some(
    (k) => getBlockDef(k)?.pickRequired?.key === "development",
  );
}

/**
 * Materialise a preset into block instances carrying their defaults.
 *
 * `development`, when given, is written into every project section — the
 * "pick the project once" half of the Project launch preset. Without it those
 * sections start empty and the editor marks each one.
 */
export function presetBlocks(
  key: string,
  opts: { development?: string | null } = {},
): BlockInstance[] {
  const preset = getPreset(key);
  if (!preset) return [];
  return preset.blocks.flatMap((blockKey) => {
    const def = getBlockDef(blockKey);
    // A preset naming a block that has since been removed loses that block
    // rather than failing the whole "new page" flow.
    if (!def) return [];
    const instance = newBlockInstance(def);
    if (opts.development && def.pickRequired?.key === "development") {
      instance.values = { ...instance.values, development: opts.development };
    }
    return [instance];
  });
}
