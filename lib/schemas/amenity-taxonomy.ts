import { z } from "zod";

/**
 * Sprint 3 (backfilled): amenity-taxonomy schema.
 *
 * Sprint 8 lands the `amenities_taxonomy` Postgres table; this schema is
 * used by /admin/settings/fields once the taxonomy form ships. The shape
 * intentionally mirrors what Sprint 8 will store.
 */
export const AMENITY_CATEGORIES = [
  "indoor",
  "outdoor",
  "building",
  "community",
  "view",
  "security",
  "wellness",
] as const;

export const AMENITY_CATEGORY_LABELS: Record<
  (typeof AMENITY_CATEGORIES)[number],
  string
> = {
  indoor: "Indoor",
  outdoor: "Outdoor",
  building: "Building",
  community: "Community",
  view: "View",
  security: "Security",
  wellness: "Wellness",
};

const codeRegex = /^[a-z][a-z0-9_]*$/;

export const amenityTaxonomyEntrySchema = z.object({
  code: z
    .string()
    .min(2, "Code is too short")
    .max(40, "Code is too long")
    .regex(codeRegex, "Lowercase letters, numbers, and underscores only"),
  label: z.string().min(2, "Label is too short").max(60, "Label is too long"),
  /* Arabic twin. `.optional()` — the taxonomy is upserted by code, so an
   * omitted key is simply not written. Cap is 1.5x the English. */
  label_ar: z.string().max(90).nullable().optional(),
  category: z.enum(AMENITY_CATEGORIES),
  icon: z.string().max(40).nullable().optional(),
  sort_order: z.number().int().min(0).max(10_000).default(0),
  active: z.boolean().default(true),
});

export type AmenityTaxonomyEntry = z.infer<typeof amenityTaxonomyEntrySchema>;

/**
 * The 21 default amenities the design references. Sprint 8 seeds these
 * into `amenities_taxonomy` so the property editor's grid renders
 * against real DB data on first load.
 */
/*
 * `label_ar` sits beside each English label rather than in
 * `lib/master-pages/arabic/master.json`: this is a code SEED for a
 * client-editable table, so the Arabic has to survive being read without a
 * store lookup — the search facet reads this list directly in the browser.
 *
 * These 21 are the seed. The 87 rows the production `amenities_taxonomy`
 * table actually holds all carry `label_ar = NULL`; filling those is a data
 * task in the CMS (/admin/settings/fields), tracked in docs/FOLLOWUPS.md.
 */
export const DEFAULT_AMENITIES: AmenityTaxonomyEntry[] = [
  { code: "pool", label: "Pool", label_ar: "مسبح", category: "outdoor", icon: "pool", sort_order: 10, active: true },
  { code: "private_pool", label: "Private pool", label_ar: "مسبح خاص", category: "outdoor", icon: "pool", sort_order: 20, active: true },
  { code: "gym", label: "Gym", label_ar: "صالة رياضية", category: "wellness", icon: "dumbbell", sort_order: 30, active: true },
  { code: "spa", label: "Spa", label_ar: "منتجع صحي", category: "wellness", icon: "sparkles", sort_order: 40, active: true },
  { code: "sauna", label: "Sauna", label_ar: "ساونا", category: "wellness", icon: "flame", sort_order: 50, active: true },
  { code: "concierge", label: "Concierge", label_ar: "خدمة الكونسيرج", category: "building", icon: "bell", sort_order: 60, active: true },
  { code: "security_24h", label: "24h security", label_ar: "أمن على مدار الساعة", category: "security", icon: "shield", sort_order: 70, active: true },
  { code: "covered_parking", label: "Covered parking", label_ar: "مواقف مغطاة", category: "building", icon: "car", sort_order: 80, active: true },
  { code: "beach_access", label: "Beach access", label_ar: "منفذ إلى الشاطئ", category: "outdoor", icon: "waves", sort_order: 90, active: true },
  { code: "sea_view", label: "Sea view", label_ar: "إطلالة على البحر", category: "view", icon: "eye", sort_order: 100, active: true },
  { code: "skyline_view", label: "Skyline view", label_ar: "إطلالة على أفق المدينة", category: "view", icon: "buildings", sort_order: 110, active: true },
  { code: "park_view", label: "Park view", label_ar: "إطلالة على الحديقة", category: "view", icon: "trees", sort_order: 120, active: true },
  { code: "garden", label: "Garden", label_ar: "حديقة", category: "outdoor", icon: "leaf", sort_order: 130, active: true },
  { code: "balcony", label: "Balcony", label_ar: "شرفة", category: "outdoor", icon: "wind", sort_order: 140, active: true },
  { code: "kids_club", label: "Kids' club", label_ar: "نادي للأطفال", category: "community", icon: "users", sort_order: 150, active: true },
  { code: "maids_room", label: "Maid's room", label_ar: "غرفة خادمة", category: "indoor", icon: "bed", sort_order: 160, active: true },
  { code: "drivers_room", label: "Driver's room", label_ar: "غرفة سائق", category: "indoor", icon: "bed", sort_order: 170, active: true },
  { code: "smart_home", label: "Smart home", label_ar: "منزل ذكي", category: "indoor", icon: "cpu", sort_order: 180, active: true },
  { code: "pet_friendly", label: "Pet friendly", label_ar: "يسمح بالحيوانات الأليفة", category: "community", icon: "paw", sort_order: 190, active: true },
  { code: "walk_in_closet", label: "Walk-in closet", label_ar: "غرفة ملابس", category: "indoor", icon: "shirt", sort_order: 200, active: true },
  { code: "storage", label: "Storage", label_ar: "غرفة تخزين", category: "building", icon: "package", sort_order: 210, active: true },
];
