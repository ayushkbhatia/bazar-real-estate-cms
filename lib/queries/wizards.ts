import { cache } from "react";
import { createTranslator } from "next-intl";
import { getMessages } from "next-intl/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import type { Locale } from "@/lib/i18n/locales";
import { parseStoredSections, resolveSections, type ResolvedSection } from "@/lib/master-pages";
import {
  MORTGAGE_FLOW_DEFAULTS,
  catalogueArabic,
  catalogueEnglish,
  wizardPageDef,
  wizardSlug,
  type MortgageFlowSettings,
  type WizardKey,
} from "@/lib/master-pages/wizards";

export type WizardContent = {
  /** Every section of the wizard's document, resolved over the catalogue. */
  sections: ResolvedSection[];
  /** True when nobody has saved it yet. */
  usingDefaults: boolean;
};

/**
 * A wizard's document (Pages & blocks → Wizards), with the code defaults
 * underneath: "bilingual" for the editor, a locale for the flow. Any failure
 * reads as "nothing edited", so the flow renders its catalogue rather than
 * breaking an application in progress.
 */
export const getWizardContent = cache(async (key: WizardKey, locale: Locale | "bilingual"): Promise<WizardContent> => {
  const def = wizardPageDef(key);
  const fallback = (): WizardContent => ({ sections: resolveSections(def, null, locale), usingDefaults: true });
  if (!isSupabaseConfigured) return fallback();
  try {
    const { data, error } = await createSupabasePublicClient()
      .from("pages")
      .select("blocks")
      .eq("slug", wizardSlug(key))
      .maybeSingle();
    if (error || !data) return fallback();
    const stored = parseStoredSections(data.blocks);
    return { sections: resolveSections(def, stored, locale), usingDefaults: stored === null };
  } catch (error) {
    console.error("[wizards] failed to load the wizard document", error);
    return fallback();
  }
});

type Messages = { [key: string]: string | Messages };

function setPath(target: Messages, path: string, value: string) {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== "object") node[part] = {};
    node = node[part] as Messages;
  }
  node[parts.at(-1)!] = value;
}

export type MortgageWizardOverlay = {
  /** The `mortgage` messages an editor changed, nested as the catalogue is; empty when nothing is. */
  messages: Messages;
  flow: MortgageFlowSettings;
};

/**
 * What the mortgage flow lays over its catalogue for one locale: only the
 * messages whose resolved text differs from the catalogue's, so an unedited
 * field keeps following the catalogue, plus the Flow switches.
 */
export const getMortgageWizardOverlay = cache(async (locale: Locale): Promise<MortgageWizardOverlay> => {
  const content = await getWizardContent("mortgage-application", locale);
  return wizardOverlay(content.sections, locale);
});

/** The overlay for one locale from the resolved sections: pure, for the tests. */
export function wizardOverlay(sections: readonly ResolvedSection[], locale: Locale): MortgageWizardOverlay {
  const messages: Messages = {};
  const flow: MortgageFlowSettings = { ...MORTGAGE_FLOW_DEFAULTS };
  for (const section of sections) {
    if (section.key === "flow") {
      const first = section.values.w1_first;
      flow.w1_first = first === "pre_approval" ? "pre_approval" : "consultancy";
      for (const k of ["show_w1_rail", "show_w1_contact", "show_w2_rail"] as const) {
        const v = section.values[k];
        flow[k] = typeof v === "boolean" ? v : MORTGAGE_FLOW_DEFAULTS[k];
      }
      continue;
    }
    for (const field of section.def.fields) {
      const value = section.values[field.key];
      if (typeof value !== "string" || !value.trim()) continue;
      const base = locale === "ar" ? (catalogueArabic(field.key) ?? catalogueEnglish(field.key)) : catalogueEnglish(field.key);
      if (value !== base) setPath(messages, field.key, value);
    }
  }
  return { messages, flow };
}

/** The catalogue's messages with an overlay laid on top, key by key. */
export function overlayMessages<T>(base: T, overlay: Messages): T {
  if (!overlay || typeof overlay !== "object" || Object.keys(overlay).length === 0) return base;
  const out: Messages = { ...(base as Messages) };
  for (const [k, v] of Object.entries(overlay)) {
    const current = out[k];
    out[k] = typeof v === "object" && typeof current === "object" ? overlayMessages(current, v) : v;
  }
  return out as T;
}

/**
 * The mortgage flow's translator for server components (the shell, the
 * secure link's messages, the page title): the catalogue with the editor's
 * overlay, as `RouteMessages` hands the client components.
 */
export async function getMortgageTranslator(locale: Locale) {
  const [all, overlay] = await Promise.all([getMessages({ locale }), getMortgageWizardOverlay(locale)]);
  const mortgage = overlayMessages((all as Record<string, unknown>).mortgage as Messages, overlay.messages);
  return createTranslator({
    locale,
    // Typed as the catalogue it is laid over, so `t("…")` keeps checking its keys.
    messages: { mortgage } as unknown as { mortgage: typeof import("@/messages/en/mortgage.json") },
    namespace: "mortgage",
    getMessageFallback: ({ namespace, key }) => [namespace, key].filter(Boolean).join("."),
  });
}
