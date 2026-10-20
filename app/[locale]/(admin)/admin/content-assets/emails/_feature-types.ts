import { FileText, Building2, House, MapPin, type LucideIcon } from "lucide-react";
import type { FeatureKind, FeatureLayout } from "@/lib/content-assets/email-feature";
import type { SeedItem } from "../../_fields/types";

/**
 * One record the newsletter's Feature picker offers: the shared picker option
 * (`SeedItem`, drawn by `OptionBody` — photo, reference, facts, price) plus
 * what a featured block stores, its kind and id.
 */
export type FeatureTarget = SeedItem & { kind: FeatureKind; id: string };

export const FEATURE_KIND_META: Record<
  FeatureKind,
  { tab: string; noun: string; plural: string; icon: LucideIcon; heading: string }
> = {
  property: { tab: "Listings", noun: "listing", plural: "listings", icon: House, heading: "Featured listings" },
  development: { tab: "Projects", noun: "project", plural: "projects", icon: Building2, heading: "Featured projects" },
  article: { tab: "Articles", noun: "article", plural: "articles", icon: FileText, heading: "From Insights" },
  area: { tab: "Areas", noun: "area guide", plural: "area guides", icon: MapPin, heading: "Area guides" },
};

export const FEATURE_KIND_ORDER: FeatureKind[] = ["property", "development", "article", "area"];

export const FEATURE_LAYOUT_META: Record<FeatureLayout, { label: string; hint: string }> = {
  card: { label: "Cards", hint: "A full-width card each — photo, name, facts, price, link." },
  grid: { label: "Grid", hint: "Two to a row — photo, name and price. Good for four or six." },
  list: { label: "List", hint: "One line each with a thumbnail — for an “also new”." },
};
