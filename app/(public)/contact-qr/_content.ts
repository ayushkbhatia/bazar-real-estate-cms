import {
  getMasterPageContent,
  type MasterPageContent,
} from "@/lib/queries/master-pages";
import { img, list, str } from "@/lib/master-pages";
import type { SectionValues } from "@/lib/master-pages";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { vCardFilename, type VCardInput } from "@/lib/vcard";
import type {
  Bilingual,
  CardBlock,
  ContactRow,
} from "./_components/contact-card";

/**
 * The contact card's content, resolved once and shared by the two things that
 * need it: the page, and the /contact-qr/vcard route that turns the same
 * numbers into a downloadable contact. Keeping it here is what stops the .vcf
 * from drifting out of step with what the card shows.
 */

/** `tel:` wants digits and an optional `+`, not the spacing an editor types. */
function telHref(display: string): string {
  return `tel:${display.replace(/[^\d+]/g, "")}`;
}

/**
 * A field and its `_ar` twin. A blank Arabic value falls back to the English
 * one rather than leaving a hole — an editor who adds a row and only fills the
 * English label gets a card that still reads in both directions.
 */
function bi(values: SectionValues, key: string): Bilingual {
  const en = str(values, key) ?? "";
  return { en, ar: str(values, `${key}_ar`) ?? en };
}

/** Same string on both faces — numbers, addresses in Latin script, links. */
function same(value: string): Bilingual {
  return { en: value, ar: value };
}

/**
 * The address on the card is one line ending in the city, because that is how
 * it reads. vCard's ADR carries the city in its own slot, so leaving it in the
 * street would have Contacts show "…Al Bateen, Abu Dhabi, Abu Dhabi, UAE".
 */
function streetOf(address: string | null, city: string | null): string | null {
  if (!address || !city) return address;
  const parts = address.split(",");
  const last = parts[parts.length - 1]?.trim().toLowerCase();
  if (parts.length > 1 && last === city.trim().toLowerCase()) {
    return parts.slice(0, -1).join(",").trim();
  }
  return address;
}

export type ContactQrContent = {
  /** The whole master-page document, for the optional sections below the card. */
  content: MasterPageContent;
  /** Card stacks to render, in the editor's order. */
  blocks: CardBlock[];
  name: string;
  logoUrl: string | null;
  logoAlt: string;
  tagline: Bilingual;
  saveLabel: Bilingual;
  rows: ContactRow[];
  followLabel: Bilingual;
  socials: { network: string; href: string }[];
  mapLabel: Bilingual;
  mapHref: string | null;
  footerNote: Bilingual;
  vcard: VCardInput;
  vcardFilename: string;
};

const CARD_BLOCKS: CardBlock[] = ["card", "details", "follow"];

export async function loadContactQrContent(): Promise<ContactQrContent> {
  const content = await getMasterPageContent("contact-qr");
  const v = (key: string) => content.section(key)?.values ?? {};
  const cardV = v("card");
  const detailsV = v("details");
  const followV = v("follow");

  const name = str(cardV, "name") ?? "Bazar Real Estate";
  const logo = img(cardV, "logo");

  const mobile = str(detailsV, "mobile_number");
  const landline = str(detailsV, "landline_number");
  const email = str(detailsV, "email_address");
  const websiteHref = str(detailsV, "website_href");
  const websiteDisplay =
    str(detailsV, "website_display") ??
    websiteHref?.replace(/^https?:\/\//, "").replace(/\/$/, "") ??
    null;
  const officeAddress = str(detailsV, "office_address");
  const officeAddressAr = str(detailsV, "office_address_ar") ?? officeAddress;

  // Null whenever no number is configured — the row is dropped rather than
  // rendered as a dead link. The mobile number above already reaches WhatsApp,
  // so this stays off unless someone deliberately fills it in.
  const waHref = buildWhatsAppLink(
    str(detailsV, "whatsapp_number"),
    str(detailsV, "whatsapp_message"),
  );

  const rows: ContactRow[] = [];
  if (mobile) {
    rows.push({
      kind: "mobile",
      label: bi(detailsV, "mobile_label"),
      value: same(mobile),
      href: telHref(mobile),
      testId: "qr-mobile-link",
    });
  }
  if (landline) {
    rows.push({
      kind: "landline",
      label: bi(detailsV, "landline_label"),
      value: same(landline),
      href: telHref(landline),
      testId: "qr-call-link",
    });
  }
  if (waHref) {
    rows.push({
      kind: "whatsapp",
      label: bi(detailsV, "whatsapp_label"),
      value: same(str(detailsV, "whatsapp_number") ?? ""),
      href: waHref,
      external: true,
      testId: "qr-whatsapp-link",
    });
  }
  if (email) {
    rows.push({
      kind: "email",
      label: bi(detailsV, "email_label"),
      value: same(email),
      href: `mailto:${email}`,
      testId: "qr-email-link",
    });
  }
  if (websiteDisplay) {
    rows.push({
      kind: "website",
      label: bi(detailsV, "website_label"),
      value: same(websiteDisplay),
      href: websiteHref,
      external: true,
      testId: "qr-website-link",
    });
  }
  if (officeAddress) {
    rows.push({
      kind: "office",
      label: bi(detailsV, "office_label"),
      value: { en: officeAddress, ar: officeAddressAr ?? officeAddress },
      href: null,
    });
  }

  const socials = list<{ network?: string; href?: string }>(followV, "socials")
    .map((s) => ({
      network: (s.network ?? "").trim(),
      href: (s.href ?? "").trim(),
    }))
    .filter((s) => s.network !== "" && s.href !== "");

  return {
    content,
    blocks: content.order.filter((key): key is CardBlock =>
      (CARD_BLOCKS as string[]).includes(key),
    ),
    name,
    logoUrl: logo?.url ?? null,
    logoAlt: logo?.alt ?? name,
    tagline: bi(cardV, "tagline"),
    saveLabel: bi(cardV, "save_label"),
    rows,
    followLabel: bi(followV, "follow_label"),
    socials,
    mapLabel: bi(followV, "map_label"),
    mapHref: str(followV, "map_href"),
    footerNote: bi(followV, "footer_note"),
    vcard: {
      fullName: name,
      organisation: name,
      mobile,
      workPhone: landline,
      email,
      url: websiteHref,
      address: {
        street: streetOf(officeAddress, str(detailsV, "office_city")),
        locality: str(detailsV, "office_city"),
        country: str(detailsV, "office_country"),
      },
      note: str(cardV, "tagline"),
    },
    vcardFilename: vCardFilename(name),
  };
}
