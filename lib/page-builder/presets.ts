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

export type PresetKey = "blank" | "off_plan_launch" | "area_campaign" | "lead_gen";

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

/** Materialise a preset into block instances carrying their defaults. */
export function presetBlocks(key: string): BlockInstance[] {
  const preset = getPreset(key);
  if (!preset) return [];
  return preset.blocks.flatMap((blockKey) => {
    const def = getBlockDef(blockKey);
    // A preset naming a block that has since been removed loses that block
    // rather than failing the whole "new page" flow.
    return def ? [newBlockInstance(def)] : [];
  });
}
