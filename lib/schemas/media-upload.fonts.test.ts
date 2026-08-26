import { describe, expect, it } from "vitest";
import {
  finaliseUploadSchema,
  uploadTicketSchema,
} from "@/lib/schemas/media-upload";
import { isMintedKey, storageKey } from "@/lib/media";

/**
 * The font upload contract, end to end through the two schemas.
 *
 * This is the one seam in the Arabic-typography feature that nothing else
 * exercises: `/admin/settings/typography` is admin-only, Playwright has no
 * staff credentials, and the component test mocks `uploadToLibrary` away. So
 * "does a .woff2 actually survive `createUploadTicket` → `finaliseUpload`" is
 * asserted here rather than discovered by the client.
 *
 * The interesting half is the MIME/extension split. Fonts have to admit
 * `application/octet-stream` — it is what Windows, an SMB share and a drag out
 * of a zip all report — so the MIME set alone would wave through any file at
 * all, and the extension allowlist is what actually holds.
 */

const FONT = {
  kind: "font",
  folder: "fonts",
  filename: "bukra-regular.woff2",
  mime: "font/woff2",
  size_bytes: 48_016, // the real size of the vendored Bukra regular
} as const;

const KEY = storageKey({
  folder: "fonts",
  filename: FONT.filename,
  uuid: "3d80d770-9484-4de9-99de-d1e2e825cc70",
});

describe("font uploads", () => {
  it("mints a ticket for a woff2", () => {
    expect(uploadTicketSchema.safeParse(FONT).success).toBe(true);
  });

  it("finalises against a key the ticket step minted", () => {
    expect(
      finaliseUploadSchema.safeParse({ ...FONT, storage_key: KEY }).success,
    ).toBe(true);
    // The same check the action runs, so a caller cannot point a media_assets
    // row at an arbitrary object elsewhere in the bucket.
    expect(isMintedKey(KEY, "fonts")).toBe(true);
    expect(isMintedKey(KEY, "brand")).toBe(false);
  });

  it("accepts an .otf reported as octet-stream, which is what Windows sends", () => {
    expect(
      uploadTicketSchema.safeParse({
        ...FONT,
        filename: "bukra.otf",
        mime: "application/octet-stream",
      }).success,
    ).toBe(true);
  });

  it("accepts a font whose type the browser could not name at all", () => {
    // A file dragged off an SMB share arrives with `type: ""`. The client
    // resolves the Content-Type from the extension before asking for a ticket
    // — this asserts the schema agrees with that resolution.
    expect(
      uploadTicketSchema.safeParse({ ...FONT, mime: "font/ttf" }).success,
    ).toBe(true);
  });

  it("refuses an image, by either half of the gate", () => {
    // Right extension, wrong MIME.
    expect(uploadTicketSchema.safeParse({ ...FONT, mime: "image/png" }).success)
      .toBe(false);
    // Permitted MIME, wrong extension — the case the extension list exists for.
    expect(
      uploadTicketSchema.safeParse({
        ...FONT,
        filename: "logo.png",
        mime: "application/octet-stream",
      }).success,
    ).toBe(false);
  });

  it("refuses a font over the cap", () => {
    expect(
      uploadTicketSchema.safeParse({ ...FONT, size_bytes: 5 * 1024 * 1024 })
        .success,
    ).toBe(false);
  });

  it("does not let the font cap leak into the image policy", () => {
    // 4 MB is under the standard 25 MB ceiling; a photo that size must still
    // upload exactly as it did before this kind existed.
    expect(
      uploadTicketSchema.safeParse({
        kind: "standard",
        folder: "listings",
        filename: "villa.jpg",
        mime: "image/jpeg",
        size_bytes: 5 * 1024 * 1024,
      }).success,
    ).toBe(true);
  });
});
