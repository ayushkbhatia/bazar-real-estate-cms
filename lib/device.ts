import { headers } from "next/headers";
import { userAgent } from "next/server";

/**
 * True when the request came from a phone-class device.
 *
 * Deliberately narrow: `device.type` is `"mobile"` only for handsets —
 * tablets report `"tablet"` and desktops report `undefined`. Both of those
 * are ≥768px in practice, which is where the desktop layout is the right
 * one, so only `"mobile"` counts here.
 *
 * This is the one place we sniff the user agent. The rest of the mobile
 * build is CSS breakpoints on a single tree, and it should stay that way —
 * reach for this only when the answer has to exist *before* the HTML does.
 * The search view default is such a case: it decides which markup the server
 * renders, so a client-side correction would paint the wrong layout, then
 * re-fetch the RSC to replace it.
 *
 * Callers must already be dynamically rendered. Every search route reads
 * `searchParams`, which is enough on its own. When no UA header is present
 * (a build-time prerender, a bare curl) this returns `false`, so the desktop
 * default is what falls out.
 */
export async function isPhoneRequest(): Promise<boolean> {
  const { device } = userAgent({ headers: await headers() });
  return device.type === "mobile";
}
