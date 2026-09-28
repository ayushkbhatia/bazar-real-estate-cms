/**
 * Upload fixtures built in code, so no binary files live in the repo:
 *   · PDFs with any number of pages, optionally padded to a size;
 *   · PDFs encrypted with the standard security handler (RC4, 40-bit,
 *     revision 2, PDF 1.7 §7.6.3) — with a user password, so they won't open,
 *     or with only an owner password, so they open for anyone;
 *   · JPEG and PNG byte streams (only their signatures matter to the checks).
 */

import { createHash } from "node:crypto";

const PAD = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const out = Buffer.alloc(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255];
  }
  return out;
}

const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();
const padded = (password: string) => Buffer.concat([Buffer.from(password, "latin1"), PAD]).subarray(0, 32);

/** The /Encrypt dictionary for revision 2 (Algorithms 2, 3 and 4 of the PDF spec). */
function encryptDictionary(userPassword: string, ownerPassword: string, id: Buffer): string {
  const permissions = -44;
  const ownerKey = md5(padded(ownerPassword || userPassword)).subarray(0, 5);
  const o = rc4(ownerKey, padded(userPassword));
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissions);
  const fileKey = md5(padded(userPassword), o, p, id).subarray(0, 5);
  const u = rc4(fileKey, PAD);
  return `<< /Filter /Standard /V 1 /R 2 /O <${o.toString("hex")}> /U <${u.toString("hex")}> /P ${permissions} >>`;
}

export function buildPdf(
  opts: { pages?: number; userPassword?: string; ownerPassword?: string; padToBytes?: number } = {},
): Uint8Array {
  const pages = opts.pages ?? 1;
  const encrypted = opts.userPassword !== undefined || opts.ownerPassword !== undefined;
  const id = createHash("md5").update(JSON.stringify(opts)).digest();

  const objects: string[] = [];
  const pageIds = Array.from({ length: pages }, (_, i) => 3 + i);
  const contentIds = pageIds.map((_, i) => 3 + pages + i);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages} >>`;
  pageIds.forEach((n, i) => {
    objects[n] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[i]} 0 R >>`;
  });
  for (const n of contentIds) objects[n] = "<< /Length 0 >>\nstream\n\nendstream";
  let encryptId: number | null = null;
  if (encrypted) {
    encryptId = objects.length;
    objects[encryptId] = encryptDictionary(opts.userPassword ?? "", opts.ownerPassword ?? "", id);
  }

  // An unreferenced stream of spaces brings the file up to roughly a target size.
  const bodyWithoutPadding = objects.reduce((sum, o) => sum + (o?.length ?? 0), 0) + 400 + objects.length * 40;
  const padding = Math.max(0, (opts.padToBytes ?? 0) - bodyWithoutPadding);
  let paddingId: number | null = null;
  if (padding > 0) {
    paddingId = objects.length;
    objects[paddingId] = `<< /Length ${padding} >>\nstream\n${" ".repeat(padding)}\nendstream`;
  }

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = Buffer.byteLength(out, "latin1");
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objects.length; n++) out += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  const hexId = id.toString("hex");
  out +=
    `trailer\n<< /Size ${objects.length} /Root 1 0 R` +
    (encryptId ? ` /Encrypt ${encryptId} 0 R` : "") +
    ` /ID [<${hexId}> <${hexId}>] >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

/** A JPEG signature followed by filler, `size` bytes long. */
export function jpegBytes(size = 2048): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
}

/** A PNG signature followed by filler, `size` bytes long. */
export function pngBytes(size = 2048): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}
