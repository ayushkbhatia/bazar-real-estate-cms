import { buildVCard } from "@/lib/vcard";
import { loadContactQrContent } from "../_content";

/**
 * GET /contact-qr/vcard — the file behind "Add to Contacts".
 *
 * Served as a real download rather than built in the browser from a Blob: iOS
 * Safari hands a `text/vcard` response straight to Contacts, where a blob: URL
 * with a download attribute is inconsistent across iOS versions. It also means
 * the card the visitor saves is generated from the same CMS content the page
 * renders, not from a second copy of the numbers in client code.
 */

// The content comes from the cookie-free public client, so this caches like
// the page does — five minutes behind an edit, same as /contact-qr itself.
export const revalidate = 300;

export async function GET() {
  const { vcard, vcardFilename } = await loadContactQrContent();
  const body = buildVCard(vcard);

  return new Response(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${vcardFilename}"`,
      "Cache-Control": "public, max-age=0, s-maxage=300, must-revalidate",
    },
  });
}
