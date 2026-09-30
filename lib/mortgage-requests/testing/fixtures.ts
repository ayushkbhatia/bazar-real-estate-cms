/**
 * Upload fixtures built in code, so no binary files live in the repo:
 *   · PDFs with any number of pages, optionally padded to a size;
 *   · PDFs encrypted with the standard security handler (RC4, 40-bit,
 *     revision 2, PDF 1.7 §7.6.3) — with a user password, so they won't open,
 *     or with only an owner password, so they open for anyone;
 *   · JPEG and PNG byte streams (only their signatures matter to the checks).
 */

import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

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

/** Text in a PDF string: ASCII only, with its delimiters escaped. */
function pdfText(text: string): string {
  return text.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, (c) => `\\${c}`);
}

export function buildPdf(
  opts: {
    pages?: number;
    userPassword?: string;
    ownerPassword?: string;
    padToBytes?: number;
    /** Lines drawn on each page in Helvetica, the first as a heading (the local seed's placeholders). */
    lines?: (page: number, pages: number) => string[];
  } = {},
): Uint8Array {
  const pages = opts.pages ?? 1;
  const encrypted = opts.userPassword !== undefined || opts.ownerPassword !== undefined;
  const id = createHash("md5").update(JSON.stringify(opts)).digest();

  const objects: string[] = [];
  const pageIds = Array.from({ length: pages }, (_, i) => 3 + i);
  const contentIds = pageIds.map((_, i) => 3 + pages + i);
  const fontId = opts.lines ? 3 + pages * 2 : null;
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages} >>`;
  pageIds.forEach((n, i) => {
    const resources = fontId ? ` /Resources << /Font << /F1 ${fontId} 0 R >> >>` : "";
    objects[n] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[i]} 0 R${resources} >>`;
  });
  contentIds.forEach((n, i) => {
    const lines = opts.lines?.(i + 1, pages) ?? [];
    const body = lines.length
      ? `BT /F1 22 Tf 72 700 Td (${pdfText(lines[0]!)}) Tj /F1 11 Tf${lines
          .slice(1)
          .map((line) => ` 0 -22 Td (${pdfText(line)}) Tj`)
          .join("")} ET`
      : "";
    objects[n] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });
  if (fontId) objects[fontId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
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

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/**
 * A real, decodable PNG that looks like a card: a pale face, a darker band
 * across the top and a photo box (the local seed's image placeholders).
 */
export function cardPng(width = 856, height = 540): Uint8Array {
  const row = 1 + width * 3;
  const raw = Buffer.alloc(row * height);
  const band = Math.round(height * 0.18);
  const photo = { x0: Math.round(width * 0.06), x1: Math.round(width * 0.3), y0: Math.round(height * 0.3), y1: Math.round(height * 0.85) };
  for (let y = 0; y < height; y++) {
    raw[y * row] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const inPhoto = x >= photo.x0 && x < photo.x1 && y >= photo.y0 && y < photo.y1;
      const lines = x > width * 0.36 && x < width * 0.9 && y > height * 0.32 && y < height * 0.82 && Math.floor((y - height * 0.32) / 22) % 2 === 0 && (y - height * 0.32) % 22 < 8;
      const [r, g, b] = y < band ? [58, 86, 110] : inPhoto ? [196, 204, 212] : lines ? [210, 214, 218] : [238, 240, 236];
      const at = y * row + 1 + x * 3;
      raw[at] = r!;
      raw[at + 1] = g!;
      raw[at + 2] = b!;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      pngChunk("IHDR", header),
      pngChunk("IDAT", deflateSync(raw)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

/** A PNG signature followed by filler, `size` bytes long. */
export function pngBytes(size = 2048): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}
