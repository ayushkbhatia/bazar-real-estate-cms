/**
 * The newsletter's amenity icons: line drawings an icon grid shows over each
 * amenity's name — a pool, a gym, a cabana — the way a launch mailer lays
 * out a project's facilities.
 *
 * Email clients don't draw SVG (Gmail and Outlook drop it), so each glyph is
 * served as a PNG by `/api/newsletter/icon`, in whatever colour the block
 * asks for, and cached at the edge for a year. The glyphs are Lucide's — the
 * icon set the site already uses — copied into `amenity-glyphs.ts` by
 * `scripts/email/amenity-icons.mjs`.
 *
 * Each icon also says which group it usually belongs to and the words that
 * name it, so a project's own amenity list ("Spa & Recovery Centre",
 * "Direct Golf Course Access") can be matched to a drawing and sorted into
 * outdoor / indoor / services without anyone picking by hand.
 *
 * Pure: the designer imports it for the icon picker.
 */

export type AmenityGroup = "outdoor" | "indoor" | "services";

export type AmenityIcon = {
  id: string;
  label: string;
  label_ar: string;
  group: AmenityGroup;
  /** The Lucide glyph drawn for it. */
  glyph: string;
  /** Lower-case fragments that name it in an amenity's title. Order of the list below is the order they are tried. */
  words: readonly string[];
};

/*
 * Most specific first: "Direct Waterfront Views" is the waterfront, not a
 * view; "Spa & Recovery Centre" a spa, not healthcare.
 */
export const AMENITY_ICONS: readonly AmenityIcon[] = [
  { id: "beach", label: "Private beach", label_ar: "شاطئ خاص", group: "outdoor", glyph: "umbrella", words: ["beach", "sand", "شاطئ"] },
  { id: "pool", label: "Swimming pool", label_ar: "مسبح", group: "outdoor", glyph: "waves-ladder", words: ["pool", "swim", "مسبح", "سباحة"] },
  { id: "cabana", label: "Pool cabanas", label_ar: "أكواخ المسبح", group: "outdoor", glyph: "tent", words: ["cabana", "pavilion", "gazebo", "كابانا"] },
  { id: "marina", label: "Marina", label_ar: "مرسى", group: "outdoor", glyph: "sailboat", words: ["marina", "yacht", "boat", "jetty", "berth", "مرسى", "يخت"] },
  { id: "waterfront", label: "Waterfront", label_ar: "واجهة بحرية", group: "outdoor", glyph: "waves", words: ["waterfront", "water front", "seafront", "sea", "lagoon", "canal", "water", "واجهة", "بحر"] },
  { id: "golf", label: "Golf course", label_ar: "ملعب غولف", group: "outdoor", glyph: "flag", words: ["golf", "غولف", "جولف"] },
  { id: "bbq", label: "BBQ & outdoor dining", label_ar: "شواء وطعام في الهواء الطلق", group: "outdoor", glyph: "flame", words: ["bbq", "barbecue", "barbeque", "grill", "شواء"] },
  { id: "garden", label: "Landscaped gardens", label_ar: "حدائق منسقة", group: "outdoor", glyph: "trees", words: ["garden", "park", "landscap", "green", "podium", "حديقة", "حدائق"] },
  { id: "jogging", label: "Jogging track", label_ar: "مسار للركض", group: "outdoor", glyph: "footprints", words: ["jogging", "running", "walk", "walkway", "trail", "promenade", "boardwalk", "ركض", "مشي"] },
  { id: "cycling", label: "Cycling track", label_ar: "مسار للدراجات", group: "outdoor", glyph: "bike", words: ["cycling", "cycle", "bike", "bicycle", "دراج"] },
  { id: "sports", label: "Sports courts", label_ar: "ملاعب رياضية", group: "outdoor", glyph: "volleyball", words: ["court", "tennis", "padel", "basketball", "football", "squash", "sport", "ملعب", "ملاعب", "تنس"] },
  { id: "play", label: "Kids' play area", label_ar: "منطقة ألعاب للأطفال", group: "outdoor", glyph: "toy-brick", words: ["kid", "child", "play", "playground", "nursery", "أطفال", "الأطفال"] },
  { id: "pets", label: "Pet friendly", label_ar: "مناسب للحيوانات الأليفة", group: "outdoor", glyph: "paw-print", words: ["pet", "dog", "أليف"] },
  { id: "active", label: "Active spaces", label_ar: "مساحات نشطة", group: "outdoor", glyph: "activity", words: ["active", "outdoor fitness", "calisthenic", "نشط"] },
  { id: "yoga", label: "Yoga & wellness", label_ar: "اليوغا والعافية", group: "indoor", glyph: "person-standing", words: ["yoga", "pilates", "meditat", "wellness", "wellbeing", "يوغا", "عافية"] },
  { id: "spa", label: "Spa", label_ar: "سبا", group: "indoor", glyph: "sparkles", words: ["spa", "massage", "treatment", "سبا"] },
  { id: "sauna", label: "Sauna & steam", label_ar: "ساونا وبخار", group: "indoor", glyph: "thermometer-sun", words: ["sauna", "steam", "hammam", "ساونا", "بخار"] },
  { id: "gym", label: "Gym", label_ar: "صالة رياضية", group: "indoor", glyph: "dumbbell", words: ["gym", "fitness", "رياضية", "لياقة"] },
  { id: "coworking", label: "Co-working lounge", label_ar: "مساحة عمل مشتركة", group: "indoor", glyph: "laptop", words: ["co-work", "cowork", "workspace", "business centre", "business center", "work", "عمل"] },
  { id: "lounge", label: "Residents' lounge", label_ar: "صالة السكان", group: "indoor", glyph: "sofa", words: ["lounge", "clubhouse", "club house", "majlis", "صالة", "مجلس"] },
  { id: "cinema", label: "Cinema", label_ar: "سينما", group: "indoor", glyph: "clapperboard", words: ["cinema", "theatre", "theater", "screening", "سينما"] },
  { id: "games", label: "Games room", label_ar: "غرفة ألعاب", group: "indoor", glyph: "gamepad-2", words: ["game", "ألعاب"] },
  { id: "library", label: "Library", label_ar: "مكتبة", group: "indoor", glyph: "book-open", words: ["library", "reading", "مكتبة"] },
  { id: "dining", label: "Restaurants & cafés", label_ar: "مطاعم ومقاهٍ", group: "indoor", glyph: "utensils-crossed", words: ["restaurant", "dining", "café", "cafe", "f&b", "مطعم", "مطاعم", "مقهى"] },
  { id: "retail", label: "Retail", label_ar: "متاجر", group: "indoor", glyph: "shopping-bag", words: ["retail", "shop", "shopping", "mall", "boutique", "store", "متجر", "متاجر", "تسوق"] },
  { id: "events", label: "Events hall", label_ar: "قاعة مناسبات", group: "indoor", glyph: "party-popper", words: ["event", "party", "banquet", "multipurpose", "multi-purpose", "مناسبات"] },
  { id: "concierge", label: "Concierge", label_ar: "خدمة الكونسيرج", group: "services", glyph: "concierge-bell", words: ["concierge", "butler", "hotel service", "front desk", "reception", "lobby", "كونسيرج", "استقبال"] },
  { id: "security", label: "24/7 security", label_ar: "أمن على مدار الساعة", group: "services", glyph: "shield-check", words: ["security", "guard", "gated", "cctv", "أمن", "حراسة"] },
  { id: "parking", label: "Parking", label_ar: "مواقف سيارات", group: "services", glyph: "square-parking", words: ["parking", "garage", "valet", "مواقف"] },
  { id: "smart", label: "Smart home", label_ar: "منزل ذكي", group: "services", glyph: "house-wifi", words: ["smart", "ذكي"] },
  { id: "health", label: "Healthcare", label_ar: "رعاية صحية", group: "services", glyph: "stethoscope", words: ["clinic", "health", "hospital", "medical", "recovery", "صحي", "مستشفى"] },
  { id: "school", label: "Schools", label_ar: "مدارس", group: "services", glyph: "graduation-cap", words: ["school", "education", "university", "مدرسة", "مدارس"] },
  { id: "mosque", label: "Mosque", label_ar: "مسجد", group: "services", glyph: "moon-star", words: ["mosque", "prayer", "مسجد"] },
  { id: "views", label: "Panoramic views", label_ar: "إطلالات بانورامية", group: "outdoor", glyph: "sunset", words: ["view", "panoram", "skyline", "sunset", "إطلال"] },
  { id: "amenity", label: "Amenity", label_ar: "مرفق", group: "indoor", glyph: "sparkle", words: [] },
];

export const AMENITY_GROUP_LABELS: Record<AmenityGroup, { label: string; label_ar: string }> = {
  outdoor: { label: "Outdoor leisure & recreation", label_ar: "الترفيه في الهواء الطلق" },
  indoor: { label: "Indoor wellness & lifestyle", label_ar: "العافية وأسلوب الحياة في الداخل" },
  services: { label: "Services & convenience", label_ar: "الخدمات والراحة" },
};

const BY_ID = new Map(AMENITY_ICONS.map((i) => [i.id, i]));

export function amenityIcon(id: unknown): AmenityIcon | undefined {
  return typeof id === "string" ? BY_ID.get(id) : undefined;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether `word` names something in `title`. An English word must start a
 * word ("landscap" finds "Landscaped"); a short one must also end one, plural
 * allowed, so "spa" isn't found in "spaces" or "sea" in "seating". Arabic
 * takes prefixes (ال، و), so it is a plain substring.
 */
function names(title: string, word: string): boolean {
  if (!/^[a-z]/.test(word)) return title.includes(word);
  const end = word.length <= 4 ? "(?:s|es)?(?![a-z])" : "";
  return new RegExp(`(?<![a-z])${escapeRe(word)}${end}`).test(title);
}

/** The icon an amenity's title names, or the plain one when none does. */
export function matchAmenity(title: string): AmenityIcon {
  const t = title.toLowerCase();
  return AMENITY_ICONS.find((i) => i.words.some((w) => names(t, w))) ?? BY_ID.get("amenity")!;
}

/** Which group a titled amenity sits in: its own words first ("Outdoor Yoga"), then its icon's. */
export function amenityGroup(title: string, icon: AmenityIcon): AmenityGroup {
  const t = title.toLowerCase();
  if (/\boutdoor\b|في الهواء الطلق|خارجي/.test(t)) return "outdoor";
  if (/\bindoor\b|داخلي/.test(t)) return "indoor";
  return icon.group;
}

/** The icon picker's options, in the editor. */
export const AMENITY_ICON_OPTIONS: [string, string][] = AMENITY_ICONS.map((i) => [i.id, i.id === "amenity" ? "Plain mark" : i.label]);

export const ICON_PATH = "/api/newsletter/icon";
/** The PNG is drawn at this size and shown smaller, so it is sharp on a retina screen. */
export const ICON_PX = 144;

/** The address of one icon in one colour. */
export function amenityIconUrl(siteUrl: string, id: string, hex: string): string {
  const icon = amenityIcon(id) ?? BY_ID.get("amenity")!;
  const c = /^#?[0-9a-f]{6}$/i.test(hex) ? hex.replace("#", "").toUpperCase() : "FFFFFF";
  return `${siteUrl}${ICON_PATH}?n=${icon.id}&c=${c}`;
}
