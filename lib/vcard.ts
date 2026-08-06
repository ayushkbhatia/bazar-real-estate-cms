/**
 * vCard builder — the file behind "Add to Contacts" on /contact-qr.
 *
 * Version 3.0 rather than 4.0 on purpose. 3.0 is what iOS Contacts, Google
 * Contacts and every Android dialler have parsed for a decade; 4.0 buys us
 * nothing this card uses and is still unevenly supported. Lines are joined
 * with CRLF because RFC 2426 says so and some Android importers enforce it.
 *
 * The output is deterministic — no REV timestamp — so the response caches and
 * the unit test can assert on the whole string.
 */

export type VCardAddress = {
  /** Building and street. Newlines survive as vCard line breaks. */
  street?: string | null;
  locality?: string | null;
  region?: string | null;
  postcode?: string | null;
  country?: string | null;
};

export type VCardInput = {
  /** What Contacts shows as the card's title. */
  fullName: string;
  organisation?: string | null;
  /** Personal number — imports as "mobile". */
  mobile?: string | null;
  /** Switchboard / landline — imports as "work". */
  workPhone?: string | null;
  email?: string | null;
  url?: string | null;
  address?: VCardAddress | null;
  note?: string | null;
};

const CRLF = "\r\n";

/**
 * RFC 2426 §5: backslash, comma, semicolon and newline are the escapable
 * characters, and the backslash has to go first or it re-escapes the escapes.
 */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function clean(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function buildVCard(input: VCardInput): string {
  const org = clean(input.organisation);
  // An organisation card still needs an N — it is mandatory in 3.0. With no
  // given name to split out, the whole thing goes in the family-name slot,
  // which is what Apple and Google emit for company cards too.
  const fullName = clean(input.fullName) || org;

  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

  lines.push(`N:${esc(fullName)};;;;`);
  lines.push(`FN:${esc(fullName)}`);
  if (org) lines.push(`ORG:${esc(org)}`);

  const mobile = clean(input.mobile);
  if (mobile) lines.push(`TEL;TYPE=CELL,VOICE:${esc(mobile)}`);

  const work = clean(input.workPhone);
  if (work) lines.push(`TEL;TYPE=WORK,VOICE:${esc(work)}`);

  const email = clean(input.email);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,PREF:${esc(email)}`);

  const url = clean(input.url);
  if (url) lines.push(`URL:${esc(url)}`);

  const address = input.address;
  if (address) {
    // po-box;extended;street;locality;region;postcode;country
    const parts = [
      clean(address.street),
      clean(address.locality),
      clean(address.region),
      clean(address.postcode),
      clean(address.country),
    ];
    if (parts.some((p) => p !== "")) {
      lines.push(`ADR;TYPE=WORK:;;${parts.map(esc).join(";")}`);
    }
  }

  const note = clean(input.note);
  if (note) lines.push(`NOTE:${esc(note)}`);

  lines.push("END:VCARD");
  return lines.join(CRLF) + CRLF;
}

/** `Bazar Real Estate` → `bazar-real-estate.vcf`. */
export function vCardFilename(name: string): string {
  const slug = clean(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "contact"}.vcf`;
}
