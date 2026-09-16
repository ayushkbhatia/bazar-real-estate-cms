import { z } from "zod";

/**
 * Email design — the chrome every email the site sends is wrapped in.
 *
 * One set of choices, stored as `site_settings.email_branding` (migration
 * 0127) and applied to ALL of them: the built-in templates in
 * lib/email-templates.ts as much as a rewritten system email. A logo that only
 * appeared once someone had also rewritten the wording would be a logo on two
 * emails out of eighteen.
 *
 * OVERRIDES, NOT A COPY. The column holds only what an editor changed; every
 * key is optional and `{}` resolves to `DEFAULT_EMAIL_BRAND`, which is the look
 * the emails had before this existed, value for value. Applying the migration
 * therefore changes not one sent email.
 *
 * Pure module — no database, no env — so the design form can import the
 * schema and the defaults on the client.
 */

export const EMAIL_HEADER_STYLES = ["wordmark", "logo"] as const;
export type EmailHeaderStyle = (typeof EMAIL_HEADER_STYLES)[number];

export const EMAIL_ALIGNMENTS = ["left", "center"] as const;
export type EmailAlignment = (typeof EMAIL_ALIGNMENTS)[number];

export type EmailBrand = {
  headerStyle: EmailHeaderStyle;
  /**
   * Media-library storage key for the logo. Preferred over `logoUrl` because
   * the URL embeds the Supabase project ref and the key survives the project
   * changing at handover — the same reasoning as lib/tiptap/figure-image.ts.
   */
  logoMediaKey: string | null;
  /** A full https URL, used when the logo did not come from the library. */
  logoUrl: string | null;
  logoAlt: string;
  /** Rendered width in CSS pixels. Height follows the image. */
  logoWidth: number;
  /** The word set in serif italic when there is no logo. */
  wordmark: string;
  /** The small line after the wordmark — "· Abu Dhabi". */
  tagline: string;
  /**
   * The Arabic half of the brand's WORDS. Blank means the English is used in
   * both, which is the right default for a wordmark that is already a name.
   * The logo, the colours and the widths have no Arabic twin: they are one
   * design in both languages.
   */
  wordmarkAr: string;
  taglineAr: string;
  headerAlign: EmailAlignment;
  /** Page background behind the message. */
  backgroundColor: string;
  /** Body text. */
  textColor: string;
  /** Muted text: the footer, captions, the small print under a button. */
  mutedColor: string;
  /** Primary button fill. */
  buttonColor: string;
  /** Text on a primary button. */
  buttonTextColor: string;
  /** Links, and the rule beside a quoted message. */
  linkColor: string;
  /** Lines under the footer's company details, one per line. */
  footerText: string;
  footerLinkLabel: string;
  footerTextAr: string;
  footerLinkLabelAr: string;
  /** Blank means the site's own address. */
  footerLinkUrl: string;
};

export const DEFAULT_EMAIL_BRAND: EmailBrand = {
  headerStyle: "wordmark",
  logoMediaKey: null,
  logoUrl: null,
  logoAlt: "Bazar Real Estate",
  logoWidth: 132,
  wordmark: "Bazar",
  tagline: "· Abu Dhabi",
  wordmarkAr: "بازار",
  taglineAr: "· أبوظبي",
  headerAlign: "left",
  backgroundColor: "#FAFAF6",
  textColor: "#1B1A17",
  mutedColor: "#99896e",
  buttonColor: "#1B1A17",
  buttonTextColor: "#FFFFFF",
  linkColor: "#005777",
  footerText: "Bazar Real Estate Brokerage LLC · ORN 28041 · Abu Dhabi, UAE",
  footerLinkLabel: "bazar.ae",
  footerTextAr: "بازار للوساطة العقارية ذ.م.م · رقم التسجيل ٢٨٠٤١ · أبوظبي، الإمارات",
  footerLinkLabelAr: "bazar.ae",
  footerLinkUrl: "",
};

const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour, like #1B1A17");

/**
 * A media key as lib/media.ts mints it. Same shape the article sanitiser
 * trusts, so a key read back from the column cannot steer a URL elsewhere.
 */
const mediaKey = z
  .string()
  .regex(
    /^(brand|blog|listings|team)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/,
    "Pick the logo from the media library",
  );

/**
 * The stored bag. Every key optional; blank strings are accepted and mean
 * "use the default", so clearing a field in the form puts Bazar's value back
 * rather than rendering an email with no footer.
 */
export const emailBrandSchema = z
  .object({
    headerStyle: z.enum(EMAIL_HEADER_STYLES),
    logoMediaKey: mediaKey.nullable(),
    logoUrl: z
      .string()
      .trim()
      .max(1000)
      .refine(
        (v) => v === "" || /^https:\/\/[^\s"'<>]+$/.test(v),
        "The logo address must start with https://",
      )
      .nullable(),
    logoAlt: z.string().trim().max(120),
    logoWidth: z.number().int().min(40, "At least 40px").max(320, "At most 320px"),
    wordmark: z.string().trim().max(40),
    tagline: z.string().trim().max(60),
    wordmarkAr: z.string().trim().max(40),
    taglineAr: z.string().trim().max(60),
    headerAlign: z.enum(EMAIL_ALIGNMENTS),
    backgroundColor: hex.or(z.literal("")),
    textColor: hex.or(z.literal("")),
    mutedColor: hex.or(z.literal("")),
    buttonColor: hex.or(z.literal("")),
    buttonTextColor: hex.or(z.literal("")),
    linkColor: hex.or(z.literal("")),
    footerText: z.string().max(500),
    footerLinkLabel: z.string().trim().max(60),
    footerTextAr: z.string().max(500),
    footerLinkLabelAr: z.string().trim().max(60),
    footerLinkUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (v) => v === "" || /^https?:\/\/[^\s"'<>]+$/.test(v),
        "Use a full address, starting https://",
      ),
  })
  .partial();

export type EmailBrandOverrides = z.infer<typeof emailBrandSchema>;

/**
 * Stored overrides → a complete brand. Tolerant by design: this runs on the
 * send path, where a malformed column must cost the client their logo, never
 * the email. Each key is validated on its own, so one bad colour does not
 * discard the other choices.
 */
export function resolveEmailBrand(raw: unknown): EmailBrand {
  const out: EmailBrand = { ...DEFAULT_EMAIL_BRAND };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const bag = raw as Record<string, unknown>;
  const shape = emailBrandSchema.shape;
  for (const key of Object.keys(DEFAULT_EMAIL_BRAND) as (keyof EmailBrand)[]) {
    if (!(key in bag)) continue;
    const parsed = shape[key].safeParse(bag[key]);
    if (!parsed.success) continue;
    const value = parsed.data;
    if (value === undefined || value === null || value === "") continue;
    (out as Record<string, unknown>)[key] = value;
  }
  // A logo header with no logo to show is a header with nothing in it.
  if (out.headerStyle === "logo" && !out.logoMediaKey && !out.logoUrl) {
    out.headerStyle = "wordmark";
  }
  return out;
}

/**
 * Why a logo will not show in an inbox, or null. SVG is the common one: the
 * media library accepts it, the site renders it, and Gmail and Outlook both
 * refuse to — the header would be an empty box in most of the recipients'
 * mail.
 */
export function logoWarning(url: string | null): string | null {
  if (!url) return null;
  if (/\.svg(\?|#|$)/i.test(url)) {
    return "SVG logos don't display in Gmail or Outlook. Upload a PNG (twice the display width, for sharp screens).";
  }
  return null;
}
